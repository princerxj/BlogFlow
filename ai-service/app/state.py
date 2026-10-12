"""Shared workflow state.

LangGraph checkpoints this object after every node, so everything the workflow
needs to resume after a pause (including which LLM was chosen) must live here.
"""
from pydantic import BaseModel, Field


class BlogState(BaseModel):
    # ---- User input ---------------------------------------------------
    topic: str = Field(default="", description="Topic the blog is about")
    audience: str = Field(default="General reader", description="Target audience")

    # ---- LLM choice ---------------------------------------------------
    # Stored in state (not in RunnableConfig) because config is NOT persisted
    # by the checkpointer: a resumed run would silently fall back to defaults.
    llm_provider: str | None = Field(default=None, description="groq | openai | anthropic; None = server default")
    llm_model: str | None = Field(default=None, description="Model name; None = provider default")
    llm_temperature: float | None = Field(default=None, description="None = server default")

    # ---- Researcher output -------------------------------------------
    research: str = Field(default="", description="Research outline")
    research_feedback: str = Field(default="", description="Pending human feedback on the research")
    research_revision_count: int = Field(default=0, description="How many times research was sent back")

    # ---- Writer output ------------------------------------------------
    draft: str = Field(default="", description="Draft blog post")
    draft_feedback: str = Field(default="", description="Pending human feedback on the draft")
    revision_count: int = Field(default=0, description="How many times the draft was sent back")

    # ---- Editor output ------------------------------------------------
    final_blog: str = Field(default="", description="Final polished blog")
