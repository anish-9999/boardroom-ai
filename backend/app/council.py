from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.config import API_KEY, DEFAULT_MODEL, Persona

DEFAULT_PERSONAS: List[Persona] = [
    Persona(
        title="Regional Sales Head - Karnataka",
        description="Owns quarterly revenue in Karnataka; incentivized to grow local market share.",
        skills="Pragmatic, numbers-driven, optimistic about local expansion.",
        focus="Local customer demand, sales trends, speed of market penetration.",
    ),
    Persona(
        title="Country-wide Distribution Head",
        description="Responsible for nationwide logistics efficiency and cost control.",
        skills="Risk-aware, process-oriented, skeptical of fragmented networks.",
        focus="Unit economics, logistics complexity, vendor SLAs, scaling.",
    ),
    Persona(
        title="CEO",
        description="Balances growth with capital efficiency and long-term strategy.",
        skills="Strategic, asks for trade-offs and long-term ROI.",
        focus="Strategic positioning, capital allocation, risk profile.",
    ),
]

PARSER = StrOutputParser()


def build_prompt(persona: Persona) -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are {title}.
Description: {description}
Focus: {focus}
Skills: {skills}
Be concise and practical. Provide 3-5 bullet points.
If you make assumptions, label them.
""",
            ),
            ("user", "{question}"),
        ]
    )


def build_llm(model: Optional[str] = None, temperature: float = 0.4) -> ChatGroq:
    if not API_KEY:
        raise RuntimeError("Set GROQ_API_KEY before calling the council")
    return ChatGroq(model=model or DEFAULT_MODEL, api_key=API_KEY, temperature=temperature)


def run_persona(
    persona: Persona,
    question: str,
    llm: ChatGroq,
    temperature: float = 0.4,
) -> str:
    prompt = build_prompt(persona)
    model = persona.model or getattr(llm, "model_name", None) or DEFAULT_MODEL
    chain = prompt | llm.bind(model=model, temperature=temperature) | PARSER
    return chain.invoke(
        {
            "title": persona.title,
            "description": persona.description,
            "focus": persona.focus,
            "skills": persona.skills,
            "question": question,
        }
    )


def run_council(
    question: str,
    personas: Optional[List[Persona]] = None,
    model: Optional[str] = None,
    temperature: float = 0.4,
) -> Dict[str, object]:
    rounds: Dict[str, object] = {}
    used_personas = personas or DEFAULT_PERSONAS

    llm = build_llm(model=model, temperature=temperature)

    round1: Dict[str, str] = {}
    for persona in used_personas:
        round1[persona.title] = run_persona(persona, question, llm, temperature)

    round2: Dict[str, str] = {}
    for persona in used_personas:
        other_points = "\n\n".join(
            f"{name}:\n{content}" for name, content in round1.items() if name != persona.title
        )
        rebuttal_prompt = (
            f"Question: {question}\n"
            f"Other viewpoints:\n{other_points}\n\n"
            "Respond with key rebuttals or alignments (3-5 bullets)."
        )
        round2[persona.title] = run_persona(persona, rebuttal_prompt, llm, temperature=temperature + 0.1)

    synthesis_intro = "\n\n".join(
        [f"{name} (Round 1):\n{content}" for name, content in round1.items()]
        + [f"{name} (Round 2):\n{content}" for name, content in round2.items()]
    )

    synthesis_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are {name}.
Synthesize a boardroom decision.
Output format:
Decision: <one sentence>
Rationale: 3-5 bullets
Risks: 2-3 bullets
Next Steps: 3 bullets
Use the discussion below:
""",
            ),
            ("user", "{discussion}"),
        ]
    )
    final_chain = synthesis_prompt | llm.bind(temperature=temperature - 0.1) | PARSER
    final = final_chain.invoke({"name": used_personas[-1].title, "discussion": synthesis_intro})
    return {"round1": round1, "round2": round2, "final": final}
