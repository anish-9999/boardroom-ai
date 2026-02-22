from __future__ import annotations

from typing import Dict, List, Optional, TypedDict

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph

from app.config import API_KEY, DEFAULT_MODEL, Persona


class OrchestratorState(TypedDict, total=False):
    question: str
    personas: List[Persona]
    model: Optional[str]
    temperature: float
    needs_debate: float
    round1: Dict[str, str]
    round1_summary: str
    round2: Dict[str, str]
    round2_summary: str
    final: str
    metadata: Dict[str, object]


PARSER = StrOutputParser()


def build_llm(model: Optional[str] = None, temperature: float = 0.4) -> ChatGroq:
    if not API_KEY:
        raise RuntimeError("Set GROQ_API_KEY before calling the orchestrator")
    return ChatGroq(model=model or DEFAULT_MODEL, api_key=API_KEY, temperature=temperature)


def build_persona_prompt() -> ChatPromptTemplate:
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


def build_rebuttal_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are {title}.
Description: {description}
Focus: {focus}
Skills: {skills}
Respond with key rebuttals or alignments (3-5 bullets).
If you make assumptions, label them.
""",
            ),
            ("user", "{question}\n\nOther viewpoints:\n{other_points}"),
        ]
    )


def build_synthesis_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are the orchestrator.
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


def run_persona_view(
    persona: Persona,
    question: str,
    llm: ChatGroq,
    temperature: float,
) -> str:
    prompt = build_persona_prompt()
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


def run_persona_rebuttal(
    persona: Persona,
    question: str,
    other_points: str,
    llm: ChatGroq,
    temperature: float,
) -> str:
    prompt = build_rebuttal_prompt()
    model = persona.model or getattr(llm, "model_name", None) or DEFAULT_MODEL
    chain = prompt | llm.bind(model=model, temperature=temperature) | PARSER
    return chain.invoke(
        {
            "title": persona.title,
            "description": persona.description,
            "focus": persona.focus,
            "skills": persona.skills,
            "question": question,
            "other_points": other_points,
        }
    )


def round1_node(state: OrchestratorState) -> OrchestratorState:
    question = state["question"]
    personas = state.get("personas", [])
    temperature = state.get("temperature", 0.4)
    llm = build_llm(model=state.get("model"), temperature=temperature)

    round1: Dict[str, str] = {}
    for persona in personas:
        round1[persona.title] = run_persona_view(persona, question, llm, temperature)

    metadata = dict(state.get("metadata", {}))
    metadata.setdefault("needs_debate", state.get("needs_debate", 0.75))
    metadata["temperature"] = temperature
    metadata["model"] = state.get("model") or DEFAULT_MODEL
    metadata["persona_count"] = len(personas)
    metadata["persona_models"] = {
        persona.title: persona.model or metadata["model"] for persona in personas
    }

    return {**state, "round1": round1, "metadata": metadata}


def aggregate_round1(state: OrchestratorState) -> OrchestratorState:
    round1 = state.get("round1", {})
    summary = "\n\n".join(f"{name}:\n{content}" for name, content in round1.items())
    return {**state, "round1_summary": summary}


def debate_router(state: OrchestratorState) -> str:
    needs_debate = state.get("needs_debate", 0.75)
    return "debate" if needs_debate > 0.5 else "skip"


def round2_node(state: OrchestratorState) -> OrchestratorState:
    question = state["question"]
    personas = state.get("personas", [])
    temperature = state.get("temperature", 0.4) + 0.1
    llm = build_llm(model=state.get("model"), temperature=temperature)
    round1 = state.get("round1", {})

    round2: Dict[str, str] = {}
    for persona in personas:
        other_points = "\n\n".join(
            f"{name}:\n{content}" for name, content in round1.items() if name != persona.title
        )
        round2[persona.title] = run_persona_rebuttal(
            persona,
            question,
            other_points,
            llm,
            temperature,
        )

    metadata = dict(state.get("metadata", {}))
    metadata["debate_ran"] = True

    return {**state, "round2": round2, "metadata": metadata}


def aggregate_round2(state: OrchestratorState) -> OrchestratorState:
    round2 = state.get("round2", {})
    summary = "\n\n".join(f"{name}:\n{content}" for name, content in round2.items())
    return {**state, "round2_summary": summary}


def synthesize_node(state: OrchestratorState) -> OrchestratorState:
    round1 = state.get("round1", {})
    round2 = state.get("round2", {})

    discussion = "\n\n".join(
        [f"{name} (Round 1):\n{content}" for name, content in round1.items()]
        + [f"{name} (Round 2):\n{content}" for name, content in round2.items()]
    )

    temperature = state.get("temperature", 0.4) - 0.1
    llm = build_llm(model=state.get("model"), temperature=temperature)
    chain = build_synthesis_prompt() | llm.bind(temperature=temperature) | PARSER
    final = chain.invoke({"discussion": discussion})

    metadata = dict(state.get("metadata", {}))
    metadata.setdefault("debate_ran", False)

    return {**state, "final": final, "metadata": metadata}


def build_orchestrator_graph():
    graph = StateGraph(OrchestratorState)

    graph.add_node("round1", round1_node)
    graph.add_node("aggregate_round1", aggregate_round1)
    graph.add_node("round2", round2_node)
    graph.add_node("aggregate_round2", aggregate_round2)
    graph.add_node("synthesize", synthesize_node)

    graph.set_entry_point("round1")
    graph.add_edge("round1", "aggregate_round1")
    graph.add_conditional_edges(
        "aggregate_round1",
        debate_router,
        {"debate": "round2", "skip": "synthesize"},
    )
    graph.add_edge("round2", "aggregate_round2")
    graph.add_edge("aggregate_round2", "synthesize")
    graph.add_edge("synthesize", END)

    return graph.compile()


def run_orchestrator(
    question: str,
    personas: Optional[List[Persona]] = None,
    model: Optional[str] = None,
    temperature: float = 0.4,
    needs_debate: float = 0.75,
) -> Dict[str, object]:
    graph = build_orchestrator_graph()
    initial_state: OrchestratorState = {
        "question": question,
        "personas": personas or [],
        "model": model,
        "temperature": temperature,
        "needs_debate": needs_debate,
    }
    final_state = graph.invoke(initial_state)
    return {
        "round1": final_state.get("round1", {}),
        "round2": final_state.get("round2", {}),
        "final": final_state.get("final", ""),
        "metadata": final_state.get("metadata", {}),
    }
