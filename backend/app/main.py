from __future__ import annotations

from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import council
from app.config import MODEL_OPTIONS, Persona
from app.schemas import CouncilRequest, CouncilResponse, OptionsResponse, PersonaInput

app = FastAPI(title="Boardroom Council API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/options", response_model=OptionsResponse)
async def get_options() -> OptionsResponse:
    return OptionsResponse(models=MODEL_OPTIONS)


@app.post("/api/council", response_model=CouncilResponse)
async def run_boardroom(payload: CouncilRequest) -> CouncilResponse:
    personas = [
        Persona(
            title=persona.title,
            description=persona.description,
            skills=persona.skills,
            focus=persona.focus,
            model=persona.model,
        )
        for persona in payload.personas or []
    ]

    if not personas:
        personas = council.DEFAULT_PERSONAS

    try:
        result = council.run_council(
            question=payload.question,
            personas=personas,
            model=payload.model,
            temperature=payload.temperature or 0.4,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return CouncilResponse(**result)
