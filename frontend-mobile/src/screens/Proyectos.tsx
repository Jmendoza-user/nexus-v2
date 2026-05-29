// ============================================================
// NEXUS — Proyectos (/m/proyectos) + detalle + Agentes
// Cableado a backend real (/api/projects, /api/agents). Diseño CANON intacto.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Btn, IconBtn, ListRow, Segmented, TopBar, ScreenHeader, EmptyState, StatePill, Sheet } from '../ui';
import { Icon } from '../lib/icons';
import { api, type ProjectItem, type IssueItem, type AgentItem } from '../lib/api';
import type { Nav } from './types';

const DEFAULT_COLOR = '#7C5CFF';
const FILTER_TO_STATUS: Record<string, string[]> = {
  Activos: ['active'],
  Backlog: ['backlog'],
  Cerrados: ['done', 'archived', 'closed'],
};

function progressOf(p: { issueCount: number; doneCount: number }): number {
  return p.issueCount > 0 ? Math.round((p.doneCount / p.issueCount) * 100) : 0;
}
function fmtDue(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

function ProjectCard({ p, agentName, onClick }: { p: ProjectItem; agentName: string | null; onClick: () => void }) {
  const color = p.color || DEFAULT_COLOR;
  const progress = progressOf(p);
  const due = fmtDue(p.targetDate);
  return (
    <div className="card card-pad col gap3" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="row gap2" style={{ minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, marginTop: 5 }} />
          <span className="t-base fw6" style={{ textWrap: 'pretty' }}>{p.name}</span>
        </div>
      </div>
      <div className="col gap2">
        <div className="row between t-xs tsec">
          <span>{p.doneCount} / {p.issueCount} tareas</span>
          <span className="fw6" style={{ color }}>{progress}%</span>
        </div>
        <div className="bar" style={{ height: 5 }}><i style={{ width: progress + '%', background: color }} /></div>
      </div>
      <div className="row between">
        {agentName ? (
          <span className="chip" style={{ height: 26 }}><Icon name="bot" size={12} sw={2} />{agentName}</span>
        ) : <span />}
        {due && <span className="row gap1 t-xs tter"><Icon name="calendar" size={13} />{due}</span>}
      </div>
    </div>
  );
}

function ProyectosScreen({ nav }: { nav: Nav }) {
  const [filter, setFilter] = useState('Activos');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [pr, ag] = await Promise.all([api.projects(), api.agents()]);
      setProjects(pr.projects);
      setAgents(ag.agents);
    } catch { /* deja vacío */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const agentName = (id: string | null): string | null =>
    id ? (agents.find((a) => a.id === id)?.displayName ?? null) : null;

  const list = projects.filter((p) => (FILTER_TO_STATUS[filter] ?? ['active']).includes(p.status));
  const activeCount = projects.filter((p) => p.status === 'active').length;
  const backlogCount = projects.filter((p) => p.status === 'backlog').length;

  async function create() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      const { project } = await api.createProject({ name: n, description: desc.trim() || undefined });
      setProjects((ps) => [{ ...project, issueCount: 0, doneCount: 0 }, ...ps]);
      setName(''); setDesc(''); setSheet(false);
      nav.toast('Proyecto creado', 'check-circle', 'success');
    } catch {
      nav.toast('No se pudo crear', 'x-circle', 'danger');
    } finally { setSaving(false); }
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Proyectos</span>
        <IconBtn name="plus" solid onClick={() => setSheet(true)} />
      </div>
      <div className="grow" style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
        <ScreenHeader title="Proyectos" sub={`${activeCount} activos · ${backlogCount} en backlog`} />
        <div style={{ marginBottom: 16 }}>
          <Segmented value={filter} onChange={setFilter} options={['Activos', 'Backlog', 'Cerrados']} />
        </div>
        {loading ? (
          <p className="t-sm tsec" style={{ padding: '8px 4px' }}>Cargando…</p>
        ) : list.length ? (
          <div className="col gap3 anim-screen" key={filter}>
            {list.map((p) => (
              <ProjectCard key={p.id} p={p} agentName={agentName(p.leadAgentId)} onClick={() => nav.push('project', p)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="folder-kanban"
            title={filter === 'Cerrados' ? 'Nada cerrado aún' : filter === 'Backlog' ? 'Backlog vacío' : 'Sin proyectos activos'}
            body="Crea un proyecto y empieza a organizar tus tareas."
            cta="Crear proyecto"
            onCta={() => setSheet(true)}
          />
        )}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Nuevo proyecto">
        <div className="col gap3" style={{ padding: '4px 18px 24px' }}>
          <input className="field" placeholder="Nombre del proyecto" value={name} autoFocus
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} />
          <textarea className="field" placeholder="Descripción (opcional)" value={desc} rows={3}
            onChange={(e) => setDesc(e.target.value)} style={{ resize: 'none' }} />
          <Btn variant="primary" size="lg" full disabled={!name.trim() || saving} onClick={() => void create()}>
            {saving ? 'Creando…' : 'Crear proyecto'}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

function ProjectDetail({ nav, data }: { nav: Nav; data: ProjectItem }) {
  if (!data) { nav.back(); return null; }
  const color = data.color || DEFAULT_COLOR;
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    api.project(data.id).then((r) => { if (alive) setIssues(r.issues); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [data.id]);

  const done = issues.filter((t) => t.status === 'done').length;
  const progress = issues.length ? Math.round((done / issues.length) * 100) : 0;

  async function toggle(it: IssueItem) {
    const next = it.status === 'done' ? 'open' : 'done';
    setIssues((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: next } : x))); // optimista
    try { await api.updateIssue(data.id, it.id, { status: next }); }
    catch { setIssues((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: it.status } : x))); nav.toast('No se pudo actualizar', 'x-circle', 'danger'); }
  }
  async function addTask() {
    const t = newTask.trim();
    if (!t) return;
    setAdding(true);
    try {
      const { issue } = await api.createIssue(data.id, { title: t });
      setIssues((xs) => [...xs, issue]);
      setNewTask('');
    } catch { nav.toast('No se pudo crear la tarea', 'x-circle', 'danger'); }
    finally { setAdding(false); }
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Proyecto" right={<span style={{ width: 44 }} />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="row gap2" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: color, marginTop: 6, flexShrink: 0 }} />
          <h1 className="t-2xl fw7" style={{ margin: 0, textWrap: 'pretty' }}>{data.name}</h1>
        </div>
        {data.description && <p className="t-sm tsec" style={{ margin: '0 0 14px', textWrap: 'pretty' }}>{data.description}</p>}
        <div className="card card-pad col gap3" style={{ marginBottom: 16 }}>
          <div className="row between t-sm">
            <span className="tsec">Progreso</span>
            <span className="fw7" style={{ color }}>{progress}%</span>
          </div>
          <div className="bar"><i style={{ width: progress + '%', background: color }} /></div>
          <div className="row between t-sm" style={{ marginTop: 2 }}>
            <span className="tsec">{done} de {issues.length} tareas</span>
            {fmtDue(data.targetDate) && <span className="row gap1 tsec"><Icon name="calendar" size={14} />{fmtDue(data.targetDate)}</span>}
          </div>
        </div>

        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 4px 8px' }}>Tareas</div>
        {loading ? (
          <p className="t-sm tsec" style={{ padding: '4px' }}>Cargando…</p>
        ) : issues.length ? (
          <div className="card" style={{ marginBottom: 12 }}>
            {issues.map((t) => (
              <div key={t.id} className="lrow" onClick={() => void toggle(t)} style={{ cursor: 'pointer' }}>
                <button className="row center" style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${t.status === 'done' ? color : 'var(--border-strong)'}`, background: t.status === 'done' ? color : 'transparent', flexShrink: 0 }}>
                  {t.status === 'done' && <Icon name="check" size={14} sw={3} color="#fff" />}
                </button>
                <div className="grow col" style={{ gap: 2 }}>
                  <span className="t-base fw5" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }}>{t.title}</span>
                  <span className="t-xs tter mono">{t.identifier}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="t-sm tsec" style={{ padding: '4px 4px 12px' }}>Aún no hay tareas. Agrega la primera abajo.</p>
        )}

        <div className="row gap2" style={{ alignItems: 'center' }}>
          <input className="field" placeholder="Nueva tarea…" value={newTask} style={{ flex: 1 }}
            onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addTask(); }} />
          <button className="btn btn-primary btn-md" disabled={!newTask.trim() || adding} onClick={() => void addTask()} aria-label="Agregar tarea">
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Agentes ----
function agentDesc(a: AgentItem): string {
  const cfg = a.runtimeConfig as Record<string, unknown>;
  if (typeof cfg?.description === 'string' && cfg.description.trim()) return cfg.description;
  if (a.capabilities.length) return a.capabilities.join(' · ');
  return 'Agente de NEXUS.';
}

function AgentesScreen({ nav }: { nav: Nav }) {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.agents().then((r) => setAgents(r.agents)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Mis agentes" right={<span style={{ width: 44 }} />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        {loading ? (
          <p className="t-sm tsec" style={{ padding: '4px' }}>Cargando…</p>
        ) : (
          <div className="col gap3">
            {agents.map((a) => (
              <div key={a.id} className="card card-pad col gap3" style={{ cursor: 'pointer' }} onClick={() => nav.push('agent', a)}>
                <div className="row gap3">
                  <div className="lrow-ic" style={{ background: DEFAULT_COLOR + '22', color: DEFAULT_COLOR, width: 46, height: 46, borderRadius: 14 }}>
                    <Icon name="bot" size={24} />
                  </div>
                  <div className="grow col" style={{ gap: 3 }}>
                    <span className="t-base fw6">{a.displayName || a.name}</span>
                    <StatePill state={a.status} />
                  </div>
                  <Icon name="chevron-right" size={18} color="var(--text-tertiary)" />
                </div>
                <p className="t-sm tsec" style={{ margin: 0, textWrap: 'pretty' }}>{agentDesc(a)}</p>
                {a.capabilities.length > 0 && (
                  <div className="row gap1 wrap">
                    {a.capabilities.slice(0, 6).map((s) => <span key={s} className="chip" style={{ height: 24 }}>{s}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentDetail({ nav, data: a }: { nav: Nav; data: AgentItem }) {
  if (!a) { nav.back(); return null; }
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Agente" right={<span style={{ width: 44 }} />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="col center gap3" style={{ padding: '12px 0 20px', textAlign: 'center' }}>
          <div className="lrow-ic" style={{ background: DEFAULT_COLOR + '22', color: DEFAULT_COLOR, width: 72, height: 72, borderRadius: 22 }}>
            <Icon name="bot" size={36} />
          </div>
          <div className="col gap2" style={{ alignItems: 'center' }}>
            <h1 className="t-2xl fw7" style={{ margin: 0 }}>{a.displayName || a.name}</h1>
            <StatePill state={a.status} />
          </div>
          <p className="t-sm tsec" style={{ margin: 0, maxWidth: 280, textWrap: 'pretty' }}>{agentDesc(a)}</p>
        </div>

        {a.capabilities.length > 0 && (
          <>
            <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 4px 8px' }}>Capacidades</div>
            <div className="row gap2 wrap" style={{ marginBottom: 20 }}>
              {a.capabilities.map((s) => <span key={s} className="chip accent" style={{ height: 30 }}>{s}</span>)}
            </div>
          </>
        )}
        <div className="card card-pad col gap2">
          <div className="row gap2 t-sm fw6"><Icon name="wrench" size={15} color="var(--accent)" /> Configuración</div>
          <p className="t-sm tsec" style={{ margin: 0 }}>Adapter: {a.adapterType}. Gestiona skills y prompt en Cuenta → Mis agentes.</p>
        </div>
      </div>
      <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)' }}>
        <Btn variant="primary" size="lg" full icon="message-circle" onClick={() => nav.go('home')}>Hablar con este agente</Btn>
      </div>
    </div>
  );
}

export { ProyectosScreen, ProjectDetail, AgentesScreen, AgentDetail };
