// ============================================================
// NEXUS — Finanzas (/m/finanzas)  Resumen · Inbox · Historial
// ============================================================
import { useState, useRef } from 'react';
import { Btn, Chip, IconBtn, ListRow, Segmented, TopBar, EmptyState, Toggle } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import type { Nav } from './types';

type Any = any;

function SwipeCard({ children, onApprove, onReject, onTap }: Any) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [leaving, setLeaving] = useState(0); // -1 left, 1 right
  const startX = useRef(0);
  const moved = useRef(false);
  const TH = 92;

  function down(e: Any) { setDrag(true); moved.current = false; startX.current = (e.touches ? e.touches[0].clientX : e.clientX); }
  function move(e: Any) {
    if (!drag) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const d = x - startX.current;
    if (Math.abs(d) > 4) moved.current = true;
    setDx(d);
  }
  function up() {
    if (!drag) return;
    setDrag(false);
    if (dx > TH) { setLeaving(1); setTimeout(() => onApprove(), 180); }
    else if (dx < -TH) { setLeaving(-1); setTimeout(() => onReject(), 180); }
    else { setDx(0); if (!moved.current) onTap && onTap(); }
  }

  const approving = dx > 24, rejecting = dx < -24;
  const tx = leaving ? leaving * 460 : dx;

  return (
    <div className="swipe-wrap" style={{ marginBottom: 12 }}>
      <div className="swipe-bg" style={{ background: approving ? 'rgba(34,197,94,0.16)' : rejecting ? 'rgba(239,68,68,0.16)' : 'transparent' }}>
        <span className="row gap2 fw6 t-sm" style={{ color: 'var(--success)', opacity: approving ? 1 : 0.25 }}>
          <Icon name="check" size={22} sw={2.2} /> Aprobar
        </span>
        <span className="row gap2 fw6 t-sm" style={{ color: 'var(--danger)', opacity: rejecting ? 1 : 0.25 }}>
          Rechazar <Icon name="x" size={22} sw={2.2} />
        </span>
      </div>
      <div className="swipe-card card" style={{
        transform: `translateX(${tx}px) rotate(${tx * 0.012}deg)`,
        transition: drag ? 'none' : 'transform .2s var(--ease)',
        opacity: leaving ? 0 : 1, cursor: 'grab',
      }}
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
        onTouchStart={down} onTouchMove={move} onTouchEnd={up}>
        {children}
      </div>
    </div>
  );
}

function DraftRow({ d }: Any) {
  const ingreso = d.tipo === 'Ingreso';
  return (
    <div className="row gap3 card-pad" style={{ alignItems: 'center' }}>
      <div className="lrow-ic" style={{ background: d.color + '22', color: d.color, width: 44, height: 44 }}>
        <Icon name={d.icon} size={22} />
      </div>
      <div className="grow col" style={{ gap: 3, minWidth: 0 }}>
        <span className="t-base fw6" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.comercio}</span>
        <span className="row gap2 t-xs tsec">
          <span>{d.categoria}</span><span>·</span><span>{d.fecha}</span>
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
        <span className="t-lg fw7" style={{ color: ingreso ? 'var(--success)' : 'var(--text-primary)' }}>
          {ingreso ? '+' : '−'}{NX.fmtCOP(d.monto)}
        </span>
        <span className="chip" style={{ height: 22, padding: '0 8px' }}>
          <Icon name={d.canal === 'Gmail' ? 'mail' : d.canal === 'OCR' ? 'camera' : 'refresh-cw'} size={11} sw={2} />
          {d.confianza}% IA
        </span>
      </div>
    </div>
  );
}

function WeeklyChart({ data }: Any) {
  const max = Math.max(...data.flatMap((d: Any) => [d.in, d.out]));
  return (
    <div className="row between" style={{ alignItems: 'flex-end', height: 130, gap: 8, padding: '8px 2px 0' }}>
      {data.map((d: Any) => (
        <div key={d.d} className="col center grow" style={{ gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div className="row gap1" style={{ alignItems: 'flex-end', height: '100%' }}>
            <div style={{ width: 7, height: `${(d.in / max) * 100}%`, minHeight: d.in ? 4 : 0, background: 'var(--success)', borderRadius: 4 }} />
            <div style={{ width: 7, height: `${(d.out / max) * 100}%`, minHeight: d.out ? 4 : 0, background: 'var(--danger)', opacity: 0.85, borderRadius: 4 }} />
          </div>
          <span className="t-xs tter">{d.d}</span>
        </div>
      ))}
    </div>
  );
}

function FinanzasResumen() {
  const f = NX.finance;
  return (
    <div className="col gap4" style={{ padding: '4px 16px 24px' }}>
      <div className="card card-pad col gap3">
        <div className="row between">
          <span className="t-sm fw6 tsec">Esta semana</span>
          <div className="row gap3 t-xs">
            <span className="row gap1"><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)' }} />Ingresos</span>
            <span className="row gap1"><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger)' }} />Egresos</span>
          </div>
        </div>
        <WeeklyChart data={f.weekly} />
      </div>

      <div className="card card-pad col gap4">
        <span className="t-sm fw6 tsec">Top categorías del mes</span>
        {f.topCategories.map((c: Any) => (
          <div key={c.name} className="col gap2">
            <div className="row between t-sm">
              <span className="row gap2 fw5"><Icon name={c.icon} size={15} color={c.color} />{c.name}</span>
              <span className="fw6">{NX.fmtCOP(c.amount)}</span>
            </div>
            <div className="bar" style={{ height: 5 }}><i style={{ width: c.pct + '%', background: c.color }} /></div>
          </div>
        ))}
      </div>

      <div className="card col">
        <div className="row between card-pad" style={{ paddingBottom: 8 }}>
          <span className="t-sm fw6 tsec">Próximos pagos automáticos</span>
        </div>
        {f.upcoming.map((u: Any) => (
          <ListRow key={u.name} icon={u.icon} title={u.name} sub={u.date} chevron={false}
            rightText={NX.fmtCOP(u.amount)} />
        ))}
      </div>
    </div>
  );
}

function FinanzasInbox({ nav }: { nav: Nav }) {
  const [drafts, setDrafts] = useState(NX.drafts);
  function resolve(id: string, approved: boolean) {
    setDrafts((d: Any) => d.filter((x: Any) => x.id !== id));
    nav.toast(approved ? 'Movimiento aprobado' : 'Borrador rechazado', approved ? 'check-circle' : 'x-circle', approved ? 'success' : 'danger');
  }
  if (!drafts.length) {
    return <EmptyState icon="check-circle" title="Bandeja al día" body="No tienes borradores pendientes. Te avisaré cuando detecte un nuevo movimiento en tu Gmail." />;
  }
  return (
    <div style={{ padding: '4px 16px 24px' }}>
      <div className="row gap2 t-xs tsec" style={{ margin: '0 4px 12px' }}>
        <Icon name="zap" size={14} color="var(--warning)" />
        Desliza → aprobar · ← rechazar · toca para ver evidencia
      </div>
      {drafts.map((d: Any) => (
        <SwipeCard key={d.id} onApprove={() => resolve(d.id, true)} onReject={() => resolve(d.id, false)}
          onTap={() => nav.push('draft', d)}>
          <DraftRow d={d} />
        </SwipeCard>
      ))}
    </div>
  );
}

function FinanzasHistorial() {
  return (
    <div className="col" style={{ padding: '4px 0 24px' }}>
      <div className="row gap2" style={{ padding: '0 16px 12px', overflowX: 'auto' }}>
        {['Todo', 'Egresos', 'Ingresos', 'Mayo', 'Por canal'].map((f, i) => (
          <button key={f} className={`chip${i === 0 ? ' accent' : ''}`} style={{ cursor: 'pointer', flexShrink: 0 }}>{f}</button>
        ))}
      </div>
      <div className="card" style={{ margin: '0 16px' }}>
        {NX.history.map((h: Any) => {
          const ingreso = h.tipo === 'Ingreso';
          return (
            <ListRow key={h.id} icon={ingreso ? 'arrow-down-circle' : 'arrow-up-circle'}
              iconColor={ingreso ? 'var(--success)' : 'var(--text-secondary)'}
              title={h.comercio} sub={`${h.categoria} · ${h.fecha} · ${h.canal}`} chevron={false}
              right={<span className="t-base fw6" style={{ color: ingreso ? 'var(--success)' : 'var(--text-primary)' }}>{ingreso ? '+' : '−'}{NX.fmtCOP(h.monto)}</span>} />
          );
        })}
      </div>
    </div>
  );
}

function FinanzasScreen({ nav }: { nav: Nav }) {
  const [tab, setTab] = useState('Inbox');
  const f = NX.finance;
  const pos = f.balanceMonth >= 0;
  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Finanzas</span>
        <IconBtn name="bar-chart" onClick={() => setTab('Resumen')} />
      </div>
      <div className="grow" style={{ overflowY: 'auto' }}>
        {/* balance header */}
        <div className="col" style={{ padding: '4px 20px 16px', gap: 4 }}>
          <span className="t-sm tsec fw5">Balance de mayo</span>
          <div className="row gap3" style={{ alignItems: 'baseline' }}>
            <span className="t-4xl fw7 display" style={{ color: pos ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.02em' }}>
              {pos ? '+' : '−'}{NX.fmtCOP(Math.abs(f.balanceMonth))}
            </span>
          </div>
          <span className="row gap1 t-sm tsec"><Icon name="trending-up" size={15} color="var(--success)" /> {f.vsPrev}% vs mes anterior</span>
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <Segmented value={tab} onChange={setTab}
            options={[{ value: 'Resumen', label: 'Resumen' }, { value: 'Inbox', label: 'Inbox', badge: NX.drafts.length }, { value: 'Historial', label: 'Historial' }]} />
        </div>

        <div className="anim-screen" key={tab}>
          {tab === 'Resumen' && <FinanzasResumen />}
          {tab === 'Inbox' && <FinanzasInbox nav={nav} />}
          {tab === 'Historial' && <FinanzasHistorial />}
        </div>
      </div>
    </div>
  );
}

// ---- Draft detail (pushed screen) ----
function DraftDetail({ nav, data: d }: { nav: Nav; data: Any }) {
  if (!d) { nav.back(); return null; }
  const ingreso = d.tipo === 'Ingreso';
  function resolve(approved: boolean) {
    nav.toast(approved ? 'Movimiento aprobado' : 'Borrador rechazado', approved ? 'check-circle' : 'x-circle', approved ? 'success' : 'danger');
    nav.back();
  }
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Borrador" right={<IconBtn name="more-horizontal" />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        {/* hero */}
        <div className="card card-pad col center gap3" style={{ padding: '28px 20px' }}>
          <div className="lrow-ic" style={{ background: d.color + '22', color: d.color, width: 56, height: 56, borderRadius: 16 }}>
            <Icon name={d.icon} size={28} />
          </div>
          <span className="t-4xl fw7 display" style={{ color: ingreso ? 'var(--success)' : 'var(--text-primary)' }}>
            {ingreso ? '+' : '−'}{NX.fmtCOP(d.monto)}
          </span>
          <span className="t-base fw5">{d.comercio}</span>
          <div className="row gap2">
            <Chip tone={ingreso ? 'success' : undefined}>{d.tipo}</Chip>
            <Chip>{d.fecha}</Chip>
          </div>
        </div>

        {/* clasificación IA */}
        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 4px 8px' }}>Clasificación IA</div>
        <div className="card">
          <ListRow icon="tag" title="Categoría" rightText={d.categoria} chevron={true} />
          <ListRow icon="zap" title="Confianza" chevron={false}
            right={<Chip tone={d.confianza >= 90 ? 'success' : d.confianza >= 80 ? 'warning' : 'danger'}>{d.confianza}%</Chip>} />
          <ListRow icon={d.canal === 'Gmail' ? 'mail' : d.canal === 'OCR' ? 'camera' : 'refresh-cw'} title="Canal de origen" rightText={d.canal} chevron={false} />
        </div>

        {/* evidencia */}
        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 4px 8px' }}>Evidencia</div>
        <div className="card card-pad col gap2">
          <div className="row gap2 t-sm fw6">
            <Icon name={d.evidence.tipo === 'Gmail' ? 'mail' : 'camera'} size={16} color="var(--accent)" />
            {d.evidence.from}
          </div>
          <span className="t-sm fw5">{d.evidence.subject}</span>
          <p className="t-sm tsec mono" style={{ margin: 0, padding: 12, background: 'var(--bg-base)', borderRadius: 'var(--r-md)', lineHeight: 1.6, textWrap: 'pretty' }}>{d.evidence.snippet}</p>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
            <Icon name="link" size={15} /> Ver en {d.evidence.tipo}
          </button>
        </div>

        <div className="row between card card-pad" style={{ marginTop: 16 }}>
          <span className="t-sm fw5">Marcar como recurrente</span>
          <RecurringToggle />
        </div>
      </div>

      {/* sticky actions */}
      <div className="row gap3" style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
        <Btn variant="destructive" size="lg" full onClick={() => resolve(false)}>Rechazar</Btn>
        <Btn variant="primary" size="lg" full icon="check" onClick={() => resolve(true)}>Aprobar</Btn>
      </div>
    </div>
  );
}
function RecurringToggle() { const [on, setOn] = useState(false); return <Toggle on={on} onChange={setOn} />; }

export { FinanzasScreen, DraftDetail };
