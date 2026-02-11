from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class PersonaInput(BaseModel):
    title: str = Field(..., example="Regional Sales Head - Karnataka")
    description: str = Field(...)
    skills: str = Field(...)
    focus: str = Field(...)
    model: Optional[str] = None


class CouncilRequest(BaseModel):
    question: str = Field(..., example="Should Acme set up a distribution network?")
    personas: Optional[List[PersonaInput]] = None
    model: Optional[str] = Field(None, description="Model identifier such as llama-3.3-70b-versatile")
    temperature: Optional[float] = Field(0.4, ge=0.0, le=1.0)


class CouncilResponse(BaseModel):
    round1: Dict[str, str]
    round2: Dict[str, str]
    final: str


class OptionsResponse(BaseModel):
    models: List[str]
