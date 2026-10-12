"""Provider-agnostic LLM factory.

Agents only ever see a LangChain `BaseChatModel`, so swapping Groq for OpenAI or
Anthropic is a config change, not a code change. Install the provider package
you want (langchain-groq / langchain-openai / langchain-anthropic).
"""
import os

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

# Allow-list: provider -> default model. Edit freely.
DEFAULT_MODELS: dict[str, str] = {
    "groq": "openai/gpt-oss-20b",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
}
SUPPORTED_PROVIDERS = tuple(DEFAULT_MODELS)
DEFAULT_TEMPERATURE = 0.5


def get_llm(provider: str | None = None, model: str | None = None, temperature: float | None = None) -> BaseChatModel:
    """Build a chat model. API keys come from env (GROQ_API_KEY, OPENAI_API_KEY, ...)."""
    provider = (provider or os.getenv("DEFAULT_LLM_PROVIDER", "groq")).lower()
    if provider not in DEFAULT_MODELS:
        raise ValueError(f"Unsupported provider '{provider}'. Choose from {SUPPORTED_PROVIDERS}")
    return init_chat_model(
        model or DEFAULT_MODELS[provider],
        model_provider=provider,
        temperature=DEFAULT_TEMPERATURE if temperature is None else temperature,
    )


def llm_from_state(state) -> BaseChatModel:
    """Build the LLM chosen for this run (stored on BlogState)."""
    return get_llm(state.llm_provider, state.llm_model, state.llm_temperature)
