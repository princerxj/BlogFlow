"""Request/response models: the contract the Node/Express API codes against."""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .llm import SUPPORTED_PROVIDERS


class StartRunRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=200)
    audience: str = Field(default="General reader", max_length=200)
    # Express can pass the Mongo project id so thread_id == project id.
    thread_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,64}$")
    provider: str | None = None
    model: str | None = Field(default=None, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=1.5)

    @field_validator("provider")
    @classmethod
    def _known_provider(cls, v):
        if v is not None and v.lower() not in SUPPORTED_PROVIDERS:
            raise ValueError(f"provider must be one of {SUPPORTED_PROVIDERS}")
        return v.lower() if v else v


class ResumeRequest(BaseModel):
    action: Literal["approve", "revise"]
    feedback: str = Field(default="", max_length=4000)

    @model_validator(mode="after")
    def _revise_needs_feedback(self):
        if self.action == "revise" and not self.feedback.strip():
            raise ValueError("feedback is required when action is 'revise'")
        return self


class RunResponse(BaseModel):
    thread_id: str
    # awaiting_review: paused for a human | completed: final_blog is ready
    # stalled: a step failed (LLM error); state is saved, call /retry
    status: Literal["awaiting_review", "completed", "stalled"]
    stage: str | None = None          # researcher_review | draft_review | failed node name | None
    review: dict[str, Any] | None = None  # the interrupt payload the UI should render
    state: dict[str, Any]             # public snapshot of the workflow state
