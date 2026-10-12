"""The three agents. Each is a plain function: (llm, inputs) -> str.

They know nothing about LangGraph or HTTP, which keeps them easy to test.
"""
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate


def _text(message) -> str:
    """Normalise a model reply to a string (Anthropic can return a list of content blocks)."""
    content = message.content
    if isinstance(content, str):
        return content
    return "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)


# Researcher
RESEARCHER_SYSTEM = """You are a research agent. Given a blog topic and target audience, produce a clear, structured research outline. Include:
1. 5-7 key points the blog should cover
2. Important facts, stats, or examples for each point
3. A suggested angle or hook
Be concise. Use bullet points. Do not write the full blog yet."""

researcher_prompt = ChatPromptTemplate.from_messages([
    ("system", RESEARCHER_SYSTEM),
    ("user", "Topic: {topic}\nAudience: {audience}\n{revision_hints}\nWrite the research outline now."),
])


def researcher_agent(llm: BaseChatModel, topic: str, audience: str, feedback: str = "") -> str:
    hints = (
        f"The human gave this feedback on your previous research, please address it: {feedback}"
        if feedback else "This is your first attempt."
    )
    result = (researcher_prompt | llm).invoke({"topic": topic, "audience": audience, "revision_hints": hints})
    return _text(result)


# Writer
WRITER_SYSTEM = """You are a blog writer agent. Using the research notes provided, write a complete, engaging blog post.
Rules:
- Length: 500-800 words
- Structure: catchy title, intro hook, 3-5 sections with H2 headings, conclusion
- Tone: clear, friendly, suited to the target audience
- Use markdown formatting
- Do not add a 'word count' line at the end"""

writer_prompt = ChatPromptTemplate.from_messages([
    ("system", WRITER_SYSTEM),
    ("user", "Topic: {topic}\nAudience: {audience}\nResearch notes:\n{research}\n\n{revision_hints}\nWrite the full blog post now."),
])


def writer_agent(llm: BaseChatModel, topic: str, audience: str, research: str = "", feedback: str = "") -> str:
    hints = (
        f"The human gave this feedback on your previous draft. Apply these changes: {feedback}"
        if feedback else "This is your first attempt."
    )
    result = (writer_prompt | llm).invoke(
        {"topic": topic, "audience": audience, "research": research, "revision_hints": hints}
    )
    return _text(result)


# Editor
EDITOR_SYSTEM = """You are an editor agent, the final quality gate before publishing.
Take the draft and produce the final polished version. Specifically:
- Fix grammar, spelling, and awkward phrasing
- Tighten wordy sentences
- Improve flow and transitions between sections
- Make the title and intro more compelling if needed
- Keep the same structure and markdown formatting
- The writing should read like a human wrote it. Avoid special characters and complex or fancy words.
Output only the final polished blog post, no commentary."""

editor_prompt = ChatPromptTemplate.from_messages([
    ("system", EDITOR_SYSTEM),
    ("user", "Topic: {topic}\nDraft:\n{draft}\n\nReturn the final blog post."),
])


def editor_agent(llm: BaseChatModel, topic: str, draft: str = "") -> str:
    result = (editor_prompt | llm).invoke({"topic": topic, "draft": draft})
    return _text(result)
