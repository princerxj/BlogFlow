"""LangGraph workflow: research -> [human] -> write -> [human] -> edit.

Human review nodes call `interrupt()`, which pauses the run and persists state
in the checkpointer. Resume with `Command(resume={"action": ..., "feedback": ...})`.
"""
import os
from typing import Literal

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from .agents import editor_agent, researcher_agent, writer_agent
from .llm import llm_from_state
from .state import BlogState

# Max times the human can send research / the draft back. Counted separately.
MAX_REVISIONS = int(os.getenv("MAX_REVISIONS", "3"))
APPROVE_WORDS = {"approve", "approved", "ok", "yes", "proceed", ""}


def parse_decision(decision) -> tuple[str, str]:
    """Normalise a resume value to ('approve', '') or ('revise', feedback).

    Accepts a dict {"action", "feedback"} (API) or a plain string (notebook testing).
    A 'revise' with no feedback is treated as approve: there is nothing to act on.
    """
    if isinstance(decision, dict):
        action = str(decision.get("action", "approve")).strip().lower()
        feedback = str(decision.get("feedback", "")).strip()
    else:
        text = str(decision).strip()
        action = "approve" if text.lower() in APPROVE_WORDS else "revise"
        feedback = "" if action == "approve" else text
    if action != "revise" or not feedback:
        return "approve", ""
    return "revise", feedback


# ------------------------------------------------------------------- Nodes
# Nodes return a dict of state UPDATES instead of mutating and returning `state`.
def research_node(state: BlogState) -> dict:
    research = researcher_agent(
        llm_from_state(state), state.topic, state.audience, feedback=state.research_feedback
    )
    return {"research": research, "research_feedback": ""}


def human_review_research_node(state: BlogState) -> dict:
    can_revise = state.research_revision_count < MAX_REVISIONS
    decision = interrupt({
        "stage": "researcher_review",
        "research": state.research,
        "revision_count": state.research_revision_count,
        "max_revisions": MAX_REVISIONS,
        "can_revise": can_revise,
        "instructions": "Approve to continue to writing, or revise with feedback to send it back to the researcher.",
    })
    action, feedback = parse_decision(decision)
    if action == "revise" and can_revise:
        return {"research_feedback": feedback, "research_revision_count": state.research_revision_count + 1}
    return {"research_feedback": ""}


def writer_node(state: BlogState) -> dict:
    draft = writer_agent(
        llm_from_state(state), state.topic, state.audience,
        research=state.research, feedback=state.draft_feedback,
    )
    return {"draft": draft, "draft_feedback": ""}


def human_review_draft_node(state: BlogState) -> dict:
    can_revise = state.revision_count < MAX_REVISIONS
    decision = interrupt({
        "stage": "draft_review",
        "draft": state.draft,
        "revision_count": state.revision_count,
        "max_revisions": MAX_REVISIONS,
        "can_revise": can_revise,
        "instructions": "Approve to send to the editor, or revise with feedback to send it back to the writer.",
    })
    action, feedback = parse_decision(decision)
    if action == "revise" and can_revise:
        return {"draft_feedback": feedback, "revision_count": state.revision_count + 1}
    return {"draft_feedback": ""}


def editor_node(state: BlogState) -> dict:
    return {"final_blog": editor_agent(llm_from_state(state), state.topic, draft=state.draft)}


# ------------------------------------------------------------ Conditional edges
# The revision limit is enforced inside the review nodes (they refuse to set
# feedback past the limit), so routing only has to look at whether feedback exists.
def route_after_research_review(state: BlogState) -> Literal["research", "writer"]:
    return "research" if state.research_feedback else "writer"


def route_after_draft_review(state: BlogState) -> Literal["writer", "edit"]:
    return "writer" if state.draft_feedback else "edit"


# ------------------------------------------------------------------- Build
def build_blog_graph(checkpointer: BaseCheckpointSaver | None = None):
    """Compile the graph. Pass a persistent checkpointer for the service;
    defaults to in-memory (fine for notebooks, lost on restart)."""
    builder = StateGraph(BlogState)

    builder.add_node("research", research_node)
    builder.add_node("review_research", human_review_research_node)
    builder.add_node("writer", writer_node)
    builder.add_node("review_draft", human_review_draft_node)
    builder.add_node("edit", editor_node)

    builder.add_edge(START, "research")
    builder.add_edge("research", "review_research")
    builder.add_conditional_edges(
        "review_research", route_after_research_review, {"research": "research", "writer": "writer"}
    )
    builder.add_edge("writer", "review_draft")
    builder.add_conditional_edges(
        "review_draft", route_after_draft_review, {"writer": "writer", "edit": "edit"}
    )
    builder.add_edge("edit", END)

    return builder.compile(checkpointer=checkpointer or InMemorySaver())
