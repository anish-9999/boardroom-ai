from __future__ import annotations

from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
API_KEY = os.getenv("GROQ_API_KEY")
MODEL_OPTIONS = [m.strip() for m in os.getenv("GROQ_MODEL_OPTIONS", "llama-3.3-70b-versatile,openai/gpt-oss-120b").split(",") if m.strip()]

@dataclass
class Persona:
    title: str
    description: str
    skills: str
    focus: str
    model: str | None = None
