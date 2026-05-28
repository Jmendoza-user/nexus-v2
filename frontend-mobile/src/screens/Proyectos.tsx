// ============================================================
// NEXUS — Proyectos (/m/proyectos) + detalle + Agentes
// ============================================================
import { useState } from 'react';
import { Btn, IconBtn, ListRow, Segmented, TopBar, ScreenHeader, EmptyState, StatePill } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import type { Nav } from './types';

type Any = any;

function ProjectCard({ p, onClick }: Any) {
  return (
    <div className="card card-pad col gap3" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="row gap2" style={{ minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0, marginTop: 5 }} />
          <span className="t-base fw6" style={{ textWrap: 'pretty' }}>{p.name}</span>
        </div>
      </div>
      <div className="col gap2">
        <div className="row between t-xs tsec">
          <span>{p.tasksDone} / {p.tasksTotal} tareas</span>
          <span className="fw6" style={{ color: p.color }}>{p.progress}%</span>
        </div>
        <div className="bar" style={{ height: 5 }}><i style={{ width: p.progress + '%', background: p.color }} /></div>
      </div>
      <div className="row between">
        <span className="chip" style={{ height: 26 }}><Icon name="bot" size={12} sw={2} />{p.agent}</span>
        {p.due !== '—' && <span className="row gap1 t-xs tter"><Icon name="calendar" size={13} />{p.due}</span>}
      </div>
    </div>
  );
}

function ProyectosScreen({ nav }: { nav: Nav }) {
  const [filter, setFilter] = useState('Activos');
  const list = NX.projects.filter((p: Any) => p.status === filter);
  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Proyectos</span>
        <IconBtn name="plus" solid onClick={() => nav.toast('Nuevo proyecto', 'plus-circle', 'accent')} />
      </div>
      <div className="grow" style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
        <ScreenHeader title="Proyectos" sub="3 activos · 1 en backlog" />
        <div style={{ marginBottom: 16 }}>
          <Segmented value={filter} onChange={setFilter} options={['Activos', 'Backlog', 'Cerrados']} />
        </div>
        {list.length ? (
          <div className="col gap3 anim-screen" key={filter}>
            {list.map((p: Any) => <ProjectCard key={p.id} p={p} onClick={() => nav.push('project', p)} />)}
          </div>
        ) : (
          <EmptyState icon="folder-kanban" title={filter === 'Cerrados' ? 'Nada cerrado aún' : 'Backlog vacío'} body="Crea tu primer proyecto y deja que un agente lo lleve." cta="Crear proyecto" onCta={() => nav.toast('Nuevo proyecto', 'plus-circle', 'accent')} />
        )}
      </div>
    </div>
  );
}

function ProjectDetail({ nav, data: p }: { nav: Nav; data: Any }) {
  if (!p) { nav.back(); return null; }
  const [tab, setTab] = useState('Tareas');
  const [tasks, setTasks] = useState(p.tasks);
  function toggle(id: string) { setTasks((ts: Any) => ts.map((t: Any) => t.id === id ? { ...t, done: !t.done } : t)); }
  const done = tasks.filter((t: Any) => t.done).length;
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Proyecto"
        right={<IconBtn name="more-horizontal" />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="row gap2" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: p.color, marginTop: 6, flexShrink: 0 }} />
          <h1 className="t-2xl fw7" style={{ margin: 0, textWrap: 'pretty' }}>{p.name}</h1>
        </div>
        <div className="card card-pad col gap3" style={{ marginBottom: 16 }}>
          <div className="row between t-sm">
            <span className="tsec">Progreso</span>
            <span className="fw7" style={{ color: p.color }}>{Math.round(done / tasks.length * 100) || 0}%</span>
          </div>
          <div className="bar"><i style={{ width: (done / tasks.length * 100 || 0) + '%', background: p.color }} /></div>
          <div className="row between t-sm" style={{ marginTop: 2 }}>
            <span className="row gap2"><Icon name="bot" size={15} color="var(--text-secondary)" />{p.agent}</span>
            {p.due !== '—' && <span className="row gap1 tsec"><Icon name="calendar" size={14} />{p.due}</span>}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Segmented value={tab} onChange={setTab} options={['Tareas', 'Notas']} />
        </div>

        {tab === 'Tareas' ? (
          tasks.length ? (
            <div className="card">
              {tasks.map((t: Any) => (
                <div key={t.id} className="lrow" onClick={() => toggle(t.id)}>
                  <button className="row center" style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${t.done ? p.color : 'var(--border-strong)'}`, background: t.done ? p.color : 'transparent', flexShrink: 0 }}>
                    {t.done && <Icon name="check" size={14} sw={3} color="#fff" />}
                  </button>
                  <div className="grow col" style={{ gap: 2 }}>
                    <span className="t-base fw5" style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
                  </div>
                  {t.due && <span className="chip" style={{ height: 24 }}>{t.due}</span>}
                </div>
              ))}
            </div>
          ) : <EmptyState icon="list-checks" title="Sin tareas" body="Aún no hay tareas en este proyecto." />
        ) : (
          <div className="card card-pad col gap2">
            <div className="row gap2 t-sm fw6"><Icon name="file-text" size={15} color="var(--accent)" /> Notas vinculadas del vault</div>
            <p className="t-sm tsec" style={{ margin: 0 }}>Las notas que menciones aquí quedan enlazadas al proyecto y aparecen como backlinks en tu vault.</p>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)' }}>
        <Btn variant="secondary" size="lg" full icon="message-circle" onClick={() => nav.go('home')}>Hablar con {p.agent.split(' ')[1] || 'el agente'}</Btn>
      </div>
    </div>
  );
}

// ---- Agentes ----
function AgentesScreen({ nav }: { nav: Nav }) {
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Mis agentes"
        right={<IconBtn name="plus" />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="col gap3">
          {NX.agents.map((a: Any) => (
            <div key={a.id} className="card card-pad col gap3" style={{ cursor: 'pointer' }} onClick={() => nav.push('agent', a)}>
              <div className="row gap3">
                <div className="lrow-ic" style={{ background: a.color + '22', color: a.color, width: 46, height: 46, borderRadius: 14 }}>
                  <Icon name={a.icon} size={24} />
                </div>
                <div className="grow col" style={{ gap: 3 }}>
                  <span className="t-base fw6">{a.name}</span>
                  <StatePill state={a.state} />
                </div>
                <Icon name="chevron-right" size={18} color="var(--text-tertiary)" />
              </div>
              <p className="t-sm tsec" style={{ margin: 0 }}>{a.desc}</p>
              <div className="row gap1 wrap">
                {a.skills.map((s: string) => <span key={s} className="chip" style={{ height: 24 }}>{s}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentDetail({ nav, data: a }: { nav: Nav; data: Any }) {
  if (!a) { nav.back(); return null; }
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Agente" right={<IconBtn name="wrench" />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="col center gap3" style={{ padding: '12px 0 20px', textAlign: 'center' }}>
          <div className="lrow-ic" style={{ background: a.color + '22', color: a.color, width: 72, height: 72, borderRadius: 22 }}>
            <Icon name={a.icon} size={36} />
          </div>
          <div className="col gap2" style={{ alignItems: 'center' }}>
            <h1 className="t-2xl fw7" style={{ margin: 0 }}>{a.name}</h1>
            <StatePill state={a.state} />
          </div>
          <p className="t-sm tsec" style={{ margin: 0, maxWidth: 280, textWrap: 'pretty' }}>{a.desc}</p>
        </div>

        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 4px 8px' }}>Skills habilitadas</div>
        <div className="row gap2 wrap" style={{ marginBottom: 20 }}>
          {a.skills.map((s: string) => (
            <span key={s} className="chip accent" style={{ height: 30, paddingRight: 6 }}>
              {s} <button className="row center" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><Icon name="x" size={13} sw={2.4} /></button>
            </span>
          ))}
          <button className="chip" style={{ height: 30, cursor: 'pointer' }}><Icon name="plus" size={13} sw={2.4} /> Añadir</button>
        </div>

        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 4px 8px' }}>Runs recientes</div>
        <div className="card">
          {[
            { t: 'Indexó 6 notas del vault', d: 'hace 1 h', dur: '4.2s', cost: '$0.003' },
            { t: 'Detectó 3 movimientos en Gmail', d: 'hace 2 h', dur: '8.1s', cost: '$0.011' },
            { t: 'Resumió reunión semanal', d: 'ayer', dur: '12.4s', cost: '$0.024' },
          ].map((r, i) => (
            <ListRow key={i} icon="activity" title={r.t} sub={`${r.d} · ${r.dur}`} chevron={false}
              rightText={r.cost} />
          ))}
        </div>
      </div>
      <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)' }}>
        <Btn variant="primary" size="lg" full icon="message-circle" onClick={() => nav.go('home')}>Hablar con este agente</Btn>
      </div>
    </div>
  );
}

export { ProyectosScreen, ProjectDetail, AgentesScreen, AgentDetail };
