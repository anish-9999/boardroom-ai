import axios from 'axios';
import { useEffect, useState } from 'react';
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
  metadata?: Record<string, unknown>;
};

type Discussion = {
  id: string;
  title: string;
  question: string;
  personas: PersonaForm[];
  model: string;
  temperature: number;
  result: CouncilResult | null;
  status: 'idle' | 'running' | 'error';
  error: string | null;
  personasCollapsed: boolean;
  collapsedPersonaIds: Set<string>;
  resultsCollapsed: boolean;
  collapsedResultSections: Set<'final' | 'round1' | 'round2'>;
};

type PersonaTemplate = Omit<PersonaForm, 'id'>;

const TEMPLATE_QUESTION =
  'We are building a new backend service (5k req/s target, low latency, 3+ year lifespan, small team). Which programming language is the best fit and why?';

const TEMPLATE_PERSONAS: PersonaTemplate[] = [
  {
    title: 'Linus Torvalds (Moderator)',
    description: 'Blunt, pragmatic moderator who cuts through hype and focuses on engineering reality.',
    skills: 'Systems thinking, low-level performance, intolerance for fluffy reasoning.',
    focus: 'Maintainability, performance, operational sanity.',
    model: '',
  },
  {
    title: 'Systems Engineer',
    description: 'Owns runtime performance and memory safety for production systems.',
    skills: 'Performance profiling, low-level optimization, tooling pragmatism.',
    focus: 'Latency, throughput, memory safety, operational overhead.',
    model: '',
  },
  {
    title: 'Product Lead',
    description: 'Optimizes for delivery speed, iteration, and hiring availability.',
    skills: 'Roadmap tradeoffs, customer value framing, pragmatic delivery.',
    focus: 'Time-to-market, developer velocity, ecosystem maturity.',
    model: '',
  },
  {
    title: 'DevOps/SRE',
    description: 'Responsible for reliability, observability, and cost-efficient operations.',
    skills: 'Incident response, production readiness, CI/CD pragmatics.',
    focus: 'Stability, operability, deployment complexity, infra cost.',
    model: '',
  },
  {
    title: 'Security Engineer',
    description: 'Minimizes attack surface and enforces secure development practices.',
    skills: 'Threat modeling, secure libraries, dependency risk.',
    focus: 'Memory safety, vulnerability footprint, secure defaults.',
    model: '',
  },
  {
    title: 'Finance/CTO',
    description: 'Balances cost, hiring, and long-term maintenance risk.',
    skills: 'TCO analysis, resourcing, strategic tradeoffs.',
    focus: 'Total cost of ownership, hiring pipeline, long-term maintainability.',
    model: '',
  },
];

const createTemplatePersonas = (): PersonaForm[] =>
  TEMPLATE_PERSONAS.map((persona) => ({
    ...persona,
    id: crypto.randomUUID(),
  }));

const createDiscussion = (title: string, model: string, overrides: Partial<Discussion> = {}): Discussion => ({
  id: crypto.randomUUID(),
  title,
  question: '',
  personas: [],
  model,
  temperature: 0.4,
  result: null,
  status: 'idle',
  error: null,
  personasCollapsed: false,
  collapsedPersonaIds: new Set(),
  resultsCollapsed: false,
  collapsedResultSections: new Set(),
  ...overrides,
});

function App() {
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>(() => [
    createDiscussion('Discussion 1', ''),
  ]);
  const [activeDiscussionId, setActiveDiscussionId] = useState<string>(() => {
    return discussions[0]?.id ?? '';
  });
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scenario'>('scenario');

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/options`)
      .then((res) => {
        setModelOptions(res.data.models);
        if (res.data.models.length) {
          setDiscussions((current) =>
            current.map((discussion) =>
              discussion.model
                ? discussion
                : {
                    ...discussion,
                    model: res.data.models[0],
                  }
            )
          );
        }
      })
      .catch((err) => {
        console.error(err);
        setDiscussions((current) =>
          current.map((discussion) => ({
            ...discussion,
            error: 'Could not load model options.',
          }))
        );
      });
  }, []);

  const activeDiscussion =
    discussions.find((discussion) => discussion.id === activeDiscussionId) ?? discussions[0];

  useEffect(() => {
    if (!activeDiscussion && discussions.length) {
      setActiveDiscussionId(discussions[0].id);
    }
  }, [activeDiscussion, discussions]);

  const updateDiscussion = (id: string, updater: (discussion: Discussion) => Discussion) => {
    setDiscussions((current) =>
      current.map((discussion) => (discussion.id === id ? updater(discussion) : discussion))
    );
  };

  const addDiscussion = (discussion: Discussion) => {
    setDiscussions((current) => [...current, discussion]);
    setActiveDiscussionId(discussion.id);
  };

  const handleNewDiscussion = () => {
    const nextIndex = discussions.length + 1;
    const newDiscussion = createDiscussion(`Discussion ${nextIndex}`, modelOptions[0] ?? '');
    addDiscussion(newDiscussion);
  };

  const handleTemplateDiscussion = () => {
    setTemplateMenuOpen(false);
    const newDiscussion = createDiscussion('Language Selection (Template)', modelOptions[0] ?? '', {
      question: TEMPLATE_QUESTION,
      personas: createTemplatePersonas(),
    });
    addDiscussion(newDiscussion);
  };

  const runCouncil = async () => {
    if (!activeDiscussion) return;
    if (activeDiscussion.personas.length < 2) {
      updateDiscussion(activeDiscussion.id, (discussion) => ({
        ...discussion,
        error: 'Add at least two personas to mimic a council.',
      }));
      return;
    }

    updateDiscussion(activeDiscussion.id, (discussion) => ({
      ...discussion,
      status: 'running',
      error: null,
    }));
    try {
      const response = await axios.post(
        `${API_BASE}/api/council`,
        {
          question: activeDiscussion.question,
          personas: activeDiscussion.personas.map(({ title, description, skills, focus, model }) => ({
            title,
            description,
            skills,
            focus,
            model: model || undefined,
          })),
          model: activeDiscussion.model || undefined,
          temperature: activeDiscussion.temperature,
        },
        {
        headers: { 'Content-Type': 'application/json' },
        }
      );
      updateDiscussion(activeDiscussion.id, (discussion) => ({
        ...discussion,
        result: response.data,
        status: 'idle',
      }));
    } catch (err) {
      console.error(err);
      updateDiscussion(activeDiscussion.id, (discussion) => ({
        ...discussion,
        error: 'Failed to run the council. Check the backend or API key.',
        status: 'error',
      }));
    }
  };

  const addPersona = () => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (discussion) => ({
      ...discussion,
      personas: [
        ...discussion.personas,
        {
          id: crypto.randomUUID(),
          title: 'New Persona',
          description: 'Describe the role in a sentence.',
          skills: 'How they contribute; e.g., analytical or bold.',
          focus: 'What they care about.',
          model: '',
        },
      ],
    }));
  };

  const updatePersona = (id: string, field: keyof PersonaForm, value: string) => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (discussion) => ({
      ...discussion,
      personas: discussion.personas.map((persona) =>
        persona.id === id ? { ...persona, [field]: value } : persona
      ),
    }));
  };

  const removePersona = (id: string) => {
    if (!activeDiscussion) return;
    if (activeDiscussion.personas.length <= 2) return;
    updateDiscussion(activeDiscussion.id, (discussion) => {
      const nextCollapsed = new Set(discussion.collapsedPersonaIds);
      nextCollapsed.delete(id);
      return {
        ...discussion,
        collapsedPersonaIds: nextCollapsed,
        personas: discussion.personas.filter((persona) => persona.id !== id),
      };
    });
  };

  const togglePersonaCollapse = (id: string) => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (discussion) => {
      const next = new Set(discussion.collapsedPersonaIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...discussion, collapsedPersonaIds: next };
    });
  };

  const toggleResultSectionCollapse = (section: 'final' | 'round1' | 'round2') => {
    if (!activeDiscussion) return;
    updateDiscussion(activeDiscussion.id, (discussion) => {
      const next = new Set(discussion.collapsedResultSections);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return { ...discussion, collapsedResultSections: next };
    });
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
      </div>

      <div className="app-frame">
        <aside className="sidebar">
          <div className="sidebar__header">
            <h2>Discussions</h2>
            <button className="ghost" type="button" onClick={handleNewDiscussion}>
              + New
            </button>
          </div>
          <div className="sidebar__list">
            {discussions.map((discussion) => (
              <button
                key={discussion.id}
                type="button"
                className={`sidebar__item ${discussion.id === activeDiscussionId ? 'is-active' : ''}`}
                onClick={() => setActiveDiscussionId(discussion.id)}
              >
                <span className="sidebar__title">{discussion.title}</span>
                <span className="sidebar__subtitle">
                  {discussion.question ? discussion.question : 'No question yet.'}
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar__template">
            <span className="sidebar__section-title">Template</span>
            <div className="template-menu">
              <button
                className="ghost"
                type="button"
                onClick={() => setTemplateMenuOpen((open) => !open)}
              >
                Start from template
              </button>
              {templateMenuOpen && (
                <div className="template-menu__list">
                  <button
                    className="template-menu__item"
                    type="button"
                    onClick={handleTemplateDiscussion}
                  >
                    Language Selection (Linus Moderator)
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="app-content">
          {activeDiscussion && (
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
              <select
                value={activeDiscussion.model}
                onChange={(event) =>
                  updateDiscussion(activeDiscussion.id, (discussion) => ({
                    ...discussion,
                    model: event.target.value,
                  }))
                }
              >
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
                value={activeDiscussion.temperature}
                onChange={(event) =>
                  updateDiscussion(activeDiscussion.id, (discussion) => ({
                    ...discussion,
                    temperature: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
        </div>
            <textarea
              className="question"
              value={activeDiscussion.question}
              onChange={(event) =>
                updateDiscussion(activeDiscussion.id, (discussion) => ({
                  ...discussion,
                  question: event.target.value,
                }))
              }
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Personas</h2>
                <p>Describe who will speak and why their perspective matters.</p>
              </div>
              <div className="controls">
                <button className="ghost" onClick={addPersona} type="button">
                  + Add persona
                </button>
                <button
                  className="ghost"
                  onClick={() =>
                    updateDiscussion(activeDiscussion.id, (discussion) => ({
                      ...discussion,
                      personasCollapsed: !discussion.personasCollapsed,
                    }))
                  }
                  type="button"
                  aria-label={
                    activeDiscussion.personasCollapsed ? 'Expand personas' : 'Collapse personas'
                  }
                  title={activeDiscussion.personasCollapsed ? 'Expand personas' : 'Collapse personas'}
                >
                  {activeDiscussion.personasCollapsed ? '▸' : '▾'}
                </button>
              </div>
            </div>
            {!activeDiscussion.personasCollapsed && (
              <div className="persona-grid">
                {activeDiscussion.personas.map((persona) => {
                  const isCollapsed = activeDiscussion.collapsedPersonaIds.has(persona.id);
                  return (
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
                          disabled={activeDiscussion.personas.length <= 2}
                          onClick={() => removePersona(persona.id)}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => togglePersonaCollapse(persona.id)}
                          aria-label={isCollapsed ? `Expand ${persona.title}` : `Collapse ${persona.title}`}
                          title={isCollapsed ? 'Expand persona' : 'Collapse persona'}
                        >
                          {isCollapsed ? '▸' : '▾'}
                        </button>
                      </div>
                      {!isCollapsed && (
                        <>
                          <label>
                            Description
                            <textarea
                              value={persona.description}
                              onChange={(event) =>
                                updatePersona(persona.id, 'description', event.target.value)
                              }
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
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel actions">
            {activeDiscussion.error && <p className="toast">{activeDiscussion.error}</p>}
            <button
              className="run"
              onClick={runCouncil}
              disabled={activeDiscussion.status === 'running'}
            >
              {activeDiscussion.status === 'running' ? 'Running council…' : 'Run council'}
            </button>
            <p className="meta">Backed by the LangChain + Groq stack you configured.</p>
          </section>

          {activeDiscussion.result && (
            <section className="panel results">
              <div className="panel-header">
                <h2>Responses</h2>
                <button
                  className="ghost"
                  type="button"
                  onClick={() =>
                    updateDiscussion(activeDiscussion.id, (discussion) => ({
                      ...discussion,
                      resultsCollapsed: !discussion.resultsCollapsed,
                    }))
                  }
                  aria-label={
                    activeDiscussion.resultsCollapsed ? 'Expand responses' : 'Collapse responses'
                  }
                  title={
                    activeDiscussion.resultsCollapsed ? 'Expand responses' : 'Collapse responses'
                  }
                >
                  {activeDiscussion.resultsCollapsed ? '▸' : '▾'}
                </button>
              </div>

              {!activeDiscussion.resultsCollapsed && (
                <>
                  <div>
                    <div className="panel-header">
                      <h2>Final Synthesis</h2>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => toggleResultSectionCollapse('final')}
                        aria-label={
                          activeDiscussion.collapsedResultSections.has('final')
                            ? 'Expand final synthesis'
                            : 'Collapse final synthesis'
                        }
                        title={
                          activeDiscussion.collapsedResultSections.has('final')
                            ? 'Expand final synthesis'
                            : 'Collapse final synthesis'
                        }
                      >
                        {activeDiscussion.collapsedResultSections.has('final') ? '▸' : '▾'}
                      </button>
                    </div>
                    {!activeDiscussion.collapsedResultSections.has('final') && (
                      <article className="final markdown-box">
                        <ReactMarkdown>{activeDiscussion.result.final}</ReactMarkdown>
                      </article>
                    )}
                  </div>

                  <div>
                    <div className="panel-header">
                      <h2>Round 1 (Initial Views)</h2>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => toggleResultSectionCollapse('round1')}
                        aria-label={
                          activeDiscussion.collapsedResultSections.has('round1')
                            ? 'Expand round 1'
                            : 'Collapse round 1'
                        }
                        title={
                          activeDiscussion.collapsedResultSections.has('round1')
                            ? 'Expand round 1'
                            : 'Collapse round 1'
                        }
                      >
                        {activeDiscussion.collapsedResultSections.has('round1') ? '▸' : '▾'}
                      </button>
                    </div>
                    {!activeDiscussion.collapsedResultSections.has('round1') && (
                      <div className="result-grid">
                        {Object.entries(activeDiscussion.result.round1).map(([name, summary]) => (
                          <article key={`r1-${name}`} className="markdown-box">
                            <h3>{name}</h3>
                            <ReactMarkdown>{summary}</ReactMarkdown>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="panel-header">
                      <h2>Round 2 (Rebuttals/Alignment)</h2>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => toggleResultSectionCollapse('round2')}
                        aria-label={
                          activeDiscussion.collapsedResultSections.has('round2')
                            ? 'Expand round 2'
                            : 'Collapse round 2'
                        }
                        title={
                          activeDiscussion.collapsedResultSections.has('round2')
                            ? 'Expand round 2'
                            : 'Collapse round 2'
                        }
                      >
                        {activeDiscussion.collapsedResultSections.has('round2') ? '▸' : '▾'}
                      </button>
                    </div>
                    {!activeDiscussion.collapsedResultSections.has('round2') && (
                      <div className="result-grid">
                        {Object.entries(activeDiscussion.result.round2).map(([name, summary]) => (
                          <article key={`r2-${name}`} className="markdown-box">
                            <h3>{name}</h3>
                            <ReactMarkdown>{summary}</ReactMarkdown>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
