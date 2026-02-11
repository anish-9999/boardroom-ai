import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type PersonaForm = {
  id: string;
  title: string;
  description: string;
  skills: string;
  focus: string;
  model: string;
};

type CouncilResult = {
  round1: Record<string, string>;
  round2: Record<string, string>;
  final: string;
};

const DEFAULT_PERSONAS: PersonaForm[] = [
  {
    id: 'regional',
    title: 'Regional Sales Head – Karnataka',
    description: 'Owns Karnataka revenue targets, feels pressure to prove local investments.',
    skills: 'Numbers-first, optimistic, values quick wins.',
    focus: 'Local demand, distribution gaps, customer experience.',
    model: '',
  },
  {
    id: 'distribution',
    title: 'Country-wide Distribution Head',
    description: 'Manages national footprint and balances capex with reliability.',
    skills: 'Process-oriented, seeks defensible risk mitigation.',
    focus: 'Cost per unit, delivery SLAs, vendor partnerships.',
    model: '',
  },
  {
    id: 'ceo',
    title: 'CEO',
    description: 'Focused on long-term positioning, stakeholder alignment, and capital efficiency.',
    skills: 'Macro-level, asks for trade-offs and forecastable outcomes.',
    focus: 'Strategic differentiation, budget discipline, risk appetite.',
    model: '',
  },
];

function App() {
  const [question, setQuestion] = useState(
    'Should Acme Corporation build its own distribution network in Karnataka or outsource it?'
  );
  const [personas, setPersonas] = useState<PersonaForm[]>(DEFAULT_PERSONAS);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.4);
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scenario' | 'about'>('scenario');

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/options`)
      .then((res) => {
        setModelOptions(res.data.models);
        if (!model && res.data.models.length) {
          setModel(res.data.models[0]);
        }
      })
      .catch((err) => {
        setError('Could not load model options.');
        console.error(err);
      });
  }, []);

  const hasEnoughPersonas = personas.length >= 2;

  const requestPayload = useMemo(() => {
    return {
      question,
      personas: personas.map(({ title, description, skills, focus, model }) => ({
        title,
        description,
        skills,
        focus,
        model: model || undefined,
      })),
      model: model || undefined,
      temperature,
    };
  }, [question, personas, model, temperature]);

  const runCouncil = async () => {
    if (!hasEnoughPersonas) {
      setError('Add at least two personas to mimic a council.');
      return;
    }

    setStatus('running');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/api/council`, requestPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      setResult(response.data);
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setError('Failed to run the council. Check the backend or API key.');
      setStatus('error');
    }
  };

  const addPersona = () => {
    setPersonas((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: 'New Persona',
        description: 'Describe the role in a sentence.',
        skills: 'How they contribute; e.g., analytical or bold.',
        focus: 'What they care about.',
        model: '',
      },
    ]);
  };

  const updatePersona = (id: string, field: keyof PersonaForm, value: string) => {
    setPersonas((current) =>
      current.map((persona) => (persona.id === id ? { ...persona, [field]: value } : persona))
    );
  };

  const removePersona = (id: string) => {
    if (personas.length <= 2) return;
    setPersonas((current) => current.filter((persona) => persona.id !== id));
  };

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="top-bar__row">
          <h1 className="app-title">Board Room AI</h1>
          <button className="profile-btn" type="button" aria-label="Account">
            <span className="profile-btn__avatar">BR</span>
          </button>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__btn ${activeTab === 'about' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
          <span className="segmented__divider" />
          <button
            type="button"
            className={`segmented__btn ${activeTab === 'scenario' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('scenario')}
          >
            Scenario
          </button>
        </div>
      </div>

      {activeTab === 'scenario' && (
        <>
          <section className="panel">
            <div className="panel-header">
          <div>
            <h2>Scenario brief</h2>
            <p>Capture a clear question so every persona responds with context and accountability.</p>
          </div>
          <div className="controls">
            <label>
              Model
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {modelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Temperature
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </label>
          </div>
        </div>
            <textarea
              className="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
          <div>
            <h2>Personas</h2>
            <p>Describe who will speak and why their perspective matters.</p>
          </div>
          <button className="ghost" onClick={addPersona} type="button">
            + Add persona
          </button>
        </div>
        <div className="persona-grid">
          {personas.map((persona) => (
            <article key={persona.id} className="persona-card">
              <div className="persona-card__head">
                <div className="persona-title-wrap">
                  <input
                    className="persona-title"
                    value={persona.title}
                    onChange={(event) => updatePersona(persona.id, 'title', event.target.value)}
                  />
                  <span className="edit-icon" aria-hidden="true">
                    ✎
                  </span>
                </div>
                <button
                  type="button"
                  className="ghost"
                  disabled={personas.length <= 2}
                  onClick={() => removePersona(persona.id)}
                >
                  Remove
                </button>
              </div>
              <label>
                Description
                <textarea
                  value={persona.description}
                  onChange={(event) => updatePersona(persona.id, 'description', event.target.value)}
                />
              </label>
              <label>
                Skills
                <input
                  value={persona.skills}
                  onChange={(event) => updatePersona(persona.id, 'skills', event.target.value)}
                />
              </label>
              <label>
                Focus
                <input
                  value={persona.focus}
                  onChange={(event) => updatePersona(persona.id, 'focus', event.target.value)}
                />
              </label>
              <label>
                Model
                <select
                  value={persona.model}
                  onChange={(event) => updatePersona(persona.id, 'model', event.target.value)}
                >
                  <option value="">Use global model</option>
                  {modelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>

          <section className="panel actions">
            {error && <p className="toast">{error}</p>}
            <button className="run" onClick={runCouncil} disabled={status === 'running'}>
              {status === 'running' ? 'Running council…' : 'Run council'}
            </button>
            <p className="meta">Backed by the LangChain + Groq stack you configured.</p>
          </section>

          {result && (
            <section className="panel results">
              <div>
                <h2>Round 1 (Initial Views)</h2>
                <div className="result-grid">
                  {Object.entries(result.round1).map(([name, summary]) => (
                    <article key={`r1-${name}`} className="markdown-box">
                      <h3>{name}</h3>
                      <ReactMarkdown>{summary}</ReactMarkdown>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <h2>Round 2 (Rebuttals/Alignment)</h2>
                <div className="result-grid">
                  {Object.entries(result.round2).map(([name, summary]) => (
                    <article key={`r2-${name}`} className="markdown-box">
                      <h3>{name}</h3>
                      <ReactMarkdown>{summary}</ReactMarkdown>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <h2>Final Synthesis</h2>
                <article className="final markdown-box">
                  <ReactMarkdown>{result.final}</ReactMarkdown>
                </article>
              </div>
            </section>
          )}

        </>
      )}

      {activeTab === 'about' && (
        <section className="panel about-panel">
          <h2>What this tool does</h2>
          <p>
            It makes persona-based boardroom conversations repeatable and traceable. You capture the
            exact question, add the people whose opinions matter, and a structured backend run delivers
            both debate (two rounds) and a concise synthesis for your next memo or decision log.
          </p>
          <p>
            Value lies in translating messy, multi-stakeholder discussion into an audit-ready output
            without losing nuance: each persona keeps its voice, rebuttals surface tensions, and the
            final synthesis spells out decision, rationale, risks, and next steps.
          </p>
          <p>
            Coming soon: attach bespoke context to each persona through documents or data so every
            voice is grounded in evidence, and adjust weightings so the final verdict reflects how much
            influence each stakeholder should wield. This is where boardroom storytelling meets
            rigorous, explainable AI assistance.
          </p>
        </section>
      )}
    </div>
  );
}

export default App;
