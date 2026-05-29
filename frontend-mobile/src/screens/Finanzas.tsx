// ============================================================
// NEXUS — Finanzas (/m/finanzas)  Resumen · Inbox · Historial
// Cableado al backend real (/api/finanzas/*). Diseño CANON intacto:
// mismas primitivas, mismas clases CSS, mismo JSX que el prototipo.
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { Btn, Chip, IconBtn, ListRow, Segmented, TopBar, EmptyState, Toggle, Sheet, Skeleton } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import { api, type TransactionView, type EvidenceView, type FinanceSummaryResponse } from '../lib/api';
import type { Nav } from './types';

type Any = any;

// ── Mapeo dominio → presentación (icono/color por categoría, sin tocar CSS) ──
const CAT_ICON: Record<string, { icon: string; color: string }> = {
  Alimentación: { icon: 'receipt', color: '#7C5CFF' },
  Transporte: { icon: 'credit-card', color: '#3B82F6' },
  Suscripciones: { icon: 'refresh-cw', color: '#34D399' },
  Servicios: { icon: 'credit-card', color: '#3B82F6' },
  Salud: { icon: 'shield', color: '#FBBF24' },
  Deudas: { icon: 'credit-card', color: '#F59E0B' },
  Ingresos: { icon: 'arrow-down-circle', color: '#22C55E' },
};
function presFor(t: { categoria: string | null; tipo: string }): { icon: string; color: string } {
  if (t.tipo === 'Ingreso') return { icon: 'arrow-down-circle', color: '#22C55E' };
  return CAT_ICON[t.categoria ?? ''] ?? { icon: 'more-horizontal', color: '#6A6A7C' };
}
function canalIcon(canal: string): string {
  return canal === 'Gmail' ? 'mail' : canal === 'OCR' ? 'camera' : canal === 'Sync' ? 'refresh-cw' : 'pencil';
}
function relFecha(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const hhmm = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoy, ${hhmm}`;
  if (yest) return `Ayer, ${hhmm}`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ── Swipe card (idéntico al prototipo) ───────────────────────────────────────
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

function DraftRow({ d }: { d: TransactionView }) {
  const ingreso = d.tipo === 'Ingreso';
  const pres = presFor(d);
  return (
    <div className="row gap3 card-pad" style={{ alignItems: 'center' }}>
      <div className="lrow-ic" style={{ background: pres.color + '22', color: pres.color, width: 44, height: 44 }}>
        <Icon name={pres.icon} size={22} />
      </div>
      <div className="grow col" style={{ gap: 3, minWidth: 0 }}>
        <span className="t-base fw6" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.comercioOrigen ?? 'Movimiento'}</span>
        <span className="row gap2 t-xs tsec">
          <span>{d.categoria ?? 'Sin categoría'}</span><span>·</span><span>{relFecha(d.fechaHora)}</span>
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
        <span className="t-lg fw7" style={{ color: ingreso ? 'var(--success)' : 'var(--text-primary)' }}>
          {ingreso ? '+' : '−'}{NX.fmtCOP(d.monto)}
        </span>
        <span className="chip" style={{ height: 22, padding: '0 8px' }}>
          <Icon name={canalIcon(d.canal)} size={11} sw={2} />
          {d.confidence ?? 0}% IA
        </span>
      </div>
    </div>
  );
}

function WeeklyChart({ data }: Any) {
  const max = Math.max(1, ...data.flatMap((d: Any) => [d.in, d.out]));
  return (
    <div className="row between" style={{ alignItems: 'flex-end', height: 130, gap: 8, padding: '8px 2px 0' }}>
      {data.map((d: Any, i: number) => (
        <div key={d.d + i} className="col center grow" style={{ gap: 6, height: '100%', justifyContent: 'flex-end' }}>
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

const CAT_COLORS = ['#7C5CFF', '#3B82F6', '#34D399', '#FBBF24', '#6A6A7C'];

function FinanzasResumen({ summary }: { summary: FinanceSummaryResponse | null }) {
  if (!summary) {
    return (
      <div className="col gap4" style={{ padding: '4px 16px 24px' }}>
        <div className="card card-pad col gap3"><Skeleton h={130} /></div>
        <div className="card card-pad col gap3"><Skeleton h={90} /></div>
      </div>
    );
  }
  const maxCat = Math.max(1, ...summary.topCategories.map((c) => c.amount));
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
        <WeeklyChart data={summary.weekly} />
      </div>

      <div className="card card-pad col gap4">
        <span className="t-sm fw6 tsec">Top categorías del mes</span>
        {summary.topCategories.length === 0 && <span className="t-sm tsec">Aún no hay gastos confirmados este mes.</span>}
        {summary.topCategories.map((c, i) => {
          const color = CAT_COLORS[i % CAT_COLORS.length];
          const pres = CAT_ICON[c.categoria] ?? { icon: 'more-horizontal', color };
          return (
            <div key={c.categoria} className="col gap2">
              <div className="row between t-sm">
                <span className="row gap2 fw5"><Icon name={pres.icon} size={15} color={color} />{c.categoria}</span>
                <span className="fw6">{NX.fmtCOP(c.amount)}</span>
              </div>
              <div className="bar" style={{ height: 5 }}><i style={{ width: Math.round((c.amount / maxCat) * 100) + '%', background: color }} /></div>
            </div>
          );
        })}
      </div>

      <div className="card col">
        <div className="row between card-pad" style={{ paddingBottom: 8 }}>
          <span className="t-sm fw6 tsec">Próximos pagos automáticos</span>
        </div>
        {summary.upcoming.length === 0 && <div className="card-pad t-sm tsec">Sin pagos recurrentes registrados.</div>}
        {summary.upcoming.map((u) => (
          <ListRow key={u.name + u.date} icon={canalIcon('Sync')} title={u.name}
            sub={new Date(u.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} chevron={false}
            rightText={NX.fmtCOP(u.amount)} />
        ))}
      </div>
    </div>
  );
}

function FinanzasInbox({ nav, drafts, loading, onResolve, onRegistrar }: Any) {
  if (loading) {
    return (
      <div style={{ padding: '4px 16px 24px' }}>
        {[0, 1, 2].map((i) => <div key={i} className="card card-pad" style={{ marginBottom: 12 }}><Skeleton h={44} /></div>)}
      </div>
    );
  }
  if (!drafts.length) {
    return (
      <EmptyState icon="check-circle" title="Bandeja al día"
        body="No tienes borradores pendientes. Te avisaré cuando detecte un nuevo movimiento en tu Gmail."
        cta="Registrar movimiento" onCta={onRegistrar} />
    );
  }
  return (
    <div style={{ padding: '4px 16px 24px' }}>
      <div className="row gap2 t-xs tsec" style={{ margin: '0 4px 12px' }}>
        <Icon name="zap" size={14} color="var(--warning)" />
        Desliza → aprobar · ← rechazar · toca para ver evidencia
      </div>
      {drafts.map((d: TransactionView) => (
        <SwipeCard key={d.id} onApprove={() => onResolve(d.id, true)} onReject={() => onResolve(d.id, false)}
          onTap={() => nav.push('draft', { txId: d.id, onResolved: onResolve })}>
          <DraftRow d={d} />
        </SwipeCard>
      ))}
    </div>
  );
}

const HIST_FILTERS: { label: string; f: Any }[] = [
  { label: 'Todo', f: {} },
  { label: 'Egresos', f: { tipo: 'Egreso' } },
  { label: 'Ingresos', f: { tipo: 'Ingreso' } },
  { label: 'Deudas', f: { tipo: 'Deuda' } },
  { label: 'Manual', f: { canal: 'Manual' } },
];

function FinanzasHistorial() {
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<TransactionView[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    api.financeTransactions({ estado: 'Confirmado', ...HIST_FILTERS[active].f })
      .then((r) => { if (alive) setRows(r.transactions); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [active]);

  return (
    <div className="col" style={{ padding: '4px 0 24px' }}>
      <div className="row gap2" style={{ padding: '0 16px 12px', overflowX: 'auto' }}>
        {HIST_FILTERS.map((f, i) => (
          <button key={f.label} className={`chip${i === active ? ' accent' : ''}`} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setActive(i)}>{f.label}</button>
        ))}
      </div>
      <div className="card" style={{ margin: '0 16px' }}>
        {rows === null && <div className="card-pad"><Skeleton h={40} /></div>}
        {rows !== null && rows.length === 0 && <div className="card-pad t-sm tsec">Sin movimientos confirmados.</div>}
        {rows?.map((h) => {
          const ingreso = h.tipo === 'Ingreso';
          return (
            <ListRow key={h.id} icon={ingreso ? 'arrow-down-circle' : 'arrow-up-circle'}
              iconColor={ingreso ? 'var(--success)' : 'var(--text-secondary)'}
              title={h.comercioOrigen ?? 'Movimiento'} sub={`${h.categoria ?? 'Sin categoría'} · ${relFecha(h.fechaHora)} · ${h.canal}`} chevron={false}
              right={<span className="t-base fw6" style={{ color: ingreso ? 'var(--success)' : 'var(--text-primary)' }}>{ingreso ? '+' : '−'}{NX.fmtCOP(h.monto)}</span>} />
          );
        })}
      </div>
    </div>
  );
}

function FinanzasScreen({ nav }: { nav: Nav }) {
  const [tab, setTab] = useState('Inbox');
  const [summary, setSummary] = useState<FinanceSummaryResponse | null>(null);
  const [drafts, setDrafts] = useState<TransactionView[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [registrar, setRegistrar] = useState(false);

  const loadSummary = useCallback(() => {
    api.financeSummary().then(setSummary).catch(() => setSummary(null));
  }, []);
  const loadDrafts = useCallback(() => {
    setDraftsLoading(true);
    api.financeTransactions({ estado: 'Borrador' })
      .then((r) => setDrafts(r.transactions))
      .catch(() => setDrafts([]))
      .finally(() => setDraftsLoading(false));
  }, []);

  useEffect(() => { loadSummary(); loadDrafts(); }, [loadSummary, loadDrafts]);

  // Optimistic resolve: quita de la lista, llama backend, refresca summary.
  const resolve = useCallback(async (id: string, approved: boolean) => {
    setDrafts((d) => d.filter((x) => x.id !== id));
    nav.toast(approved ? 'Movimiento aprobado' : 'Borrador rechazado', approved ? 'check-circle' : 'x-circle', approved ? 'success' : 'danger');
    try {
      if (approved) await api.financeApprove(id);
      else await api.financeReject(id);
      loadSummary();
    } catch {
      nav.toast('No se pudo guardar, reintenta', 'alert-triangle', 'danger');
      loadDrafts();
    }
  }, [nav, loadSummary, loadDrafts]);

  const pos = summary ? summary.balanceMonth >= 0 : true;
  const balance = summary?.balanceMonth ?? 0;
  const monthLabel = summary
    ? new Date(summary.period + '-01').toLocaleDateString('es-CO', { month: 'long' })
    : 'mes';

  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Finanzas</span>
        <div className="row gap1">
          <IconBtn name="plus" onClick={() => setRegistrar(true)} />
          <IconBtn name="bar-chart" onClick={() => setTab('Resumen')} />
        </div>
      </div>
      <div className="grow" style={{ overflowY: 'auto' }}>
        {/* balance header */}
        <div className="col" style={{ padding: '4px 20px 16px', gap: 4 }}>
          <span className="t-sm tsec fw5" style={{ textTransform: 'capitalize' }}>Balance de {monthLabel}</span>
          <div className="row gap3" style={{ alignItems: 'baseline' }}>
            {summary ? (
              <span className="t-4xl fw7 display" style={{ color: pos ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.02em' }}>
                {pos ? '+' : '−'}{NX.fmtCOP(Math.abs(balance))}
              </span>
            ) : <Skeleton w={180} h={40} />}
          </div>
          {summary && (
            <span className="row gap1 t-sm tsec">
              <Icon name={summary.vsPrev >= 0 ? 'trending-up' : 'trending-down'} size={15} color={summary.vsPrev >= 0 ? 'var(--success)' : 'var(--danger)'} />
              {summary.vsPrev}% vs mes anterior
            </span>
          )}
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <Segmented value={tab} onChange={setTab}
            options={[{ value: 'Resumen', label: 'Resumen' }, { value: 'Inbox', label: 'Inbox', badge: drafts.length }, { value: 'Historial', label: 'Historial' }]} />
        </div>

        <div className="anim-screen" key={tab}>
          {tab === 'Resumen' && <FinanzasResumen summary={summary} />}
          {tab === 'Inbox' && <FinanzasInbox nav={nav} drafts={drafts} loading={draftsLoading} onResolve={resolve} onRegistrar={() => setRegistrar(true)} />}
          {tab === 'Historial' && <FinanzasHistorial />}
        </div>
      </div>

      <RegistrarSheet open={registrar} onClose={() => setRegistrar(false)} nav={nav}
        onCreated={() => { loadSummary(); }} onUploaded={() => { loadDrafts(); setTab('Inbox'); }} />
    </div>
  );
}

// ── Registrar movimiento (manual) + subir factura (OCR) ──────────────────────
function RegistrarSheet({ open, onClose, nav, onCreated, onUploaded }: Any) {
  const [tipo, setTipo] = useState('Egreso');
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [categoria, setCategoria] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() { setTipo('Egreso'); setMonto(''); setComercio(''); setCategoria(''); }

  async function guardar() {
    const n = Number(monto.replace(/[^\d]/g, ''));
    if (!n || n <= 0) { nav.toast('Ingresa un monto válido', 'alert-triangle', 'danger'); return; }
    setSaving(true);
    try {
      await api.financeCreateManual({ tipo: tipo as Any, monto: n, comercioOrigen: comercio || null, categoria: categoria || null });
      nav.toast('Movimiento registrado', 'check-circle', 'success');
      reset(); onClose(); onCreated();
    } catch {
      nav.toast('No se pudo registrar', 'x-circle', 'danger');
    } finally { setSaving(false); }
  }

  async function onFile(e: Any) {
    const file: File | undefined = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const res = await api.financeUploadReceipt(file, file.name);
      if (!res.ocrAvailable || !res.draft) {
        nav.toast(res.message ?? 'OCR no disponible. Usa registro manual.', 'alert-triangle', 'warning');
      } else {
        nav.toast('Factura leída, revisa el borrador', 'check-circle', 'success');
        onClose(); onUploaded();
      }
    } catch {
      nav.toast('No se pudo procesar la factura', 'x-circle', 'danger');
    } finally { setSaving(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar movimiento">
      <div className="col gap4" style={{ padding: '4px 18px 24px' }}>
        <Segmented value={tipo} onChange={setTipo}
          options={[{ value: 'Egreso', label: 'Egreso' }, { value: 'Ingreso', label: 'Ingreso' }, { value: 'Deuda', label: 'Deuda' }]} />

        <div className="col gap2">
          <span className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto (COP)</span>
          <input className="input" inputMode="numeric" placeholder="0" value={monto}
            onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="col gap2">
          <span className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comercio / concepto</span>
          <input className="input" placeholder="Ej. Éxito, Nómina J4…" value={comercio} onChange={(e) => setComercio(e.target.value)} />
        </div>
        <div className="col gap2">
          <span className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categoría</span>
          <input className="input" placeholder="Ej. Alimentación, Servicios…" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        </div>

        <Btn variant="primary" size="lg" full icon="check" onClick={guardar} disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar'}
        </Btn>

        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onFile} />
        <Btn variant="ghost" size="md" full icon="camera" onClick={() => fileRef.current?.click()} disabled={saving}>
          Subir factura (OCR)
        </Btn>
      </div>
    </Sheet>
  );
}

// ---- Draft detail (pushed screen) ----
function DraftDetail({ nav, data }: { nav: Nav; data: Any }) {
  const txId: string | undefined = data?.txId;
  const [tx, setTx] = useState<TransactionView | null>(null);
  const [evidence, setEvidence] = useState<EvidenceView | null>(null);
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!txId) { nav.back(); return; }
    api.financeTransaction(txId)
      .then((r) => { setTx(r.transaction); setEvidence(r.evidence); })
      .catch(() => nav.back());
  }, [txId]);

  async function resolve(approved: boolean) {
    if (!tx) return;
    setBusy(true);
    try {
      if (approved) await api.financeApprove(tx.id);
      else await api.financeReject(tx.id);
      nav.toast(approved ? 'Movimiento aprobado' : 'Borrador rechazado', approved ? 'check-circle' : 'x-circle', approved ? 'success' : 'danger');
      data?.onResolved?.(tx.id, approved);
      nav.back();
    } catch {
      nav.toast('No se pudo guardar, reintenta', 'alert-triangle', 'danger');
      setBusy(false);
    }
  }

  if (!tx) {
    return (
      <div className="col" style={{ height: '100%' }}>
        <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Borrador" />
        <div className="col gap3" style={{ padding: 24 }}><Skeleton h={120} /><Skeleton h={80} /></div>
      </div>
    );
  }

  const ingreso = tx.tipo === 'Ingreso';
  const pres = presFor(tx);
  const conf = tx.confidence ?? 0;

  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Borrador" right={<IconBtn name="more-horizontal" />} />
      <div className="grow" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        {/* hero */}
        <div className="card card-pad col center gap3" style={{ padding: '28px 20px' }}>
          <div className="lrow-ic" style={{ background: pres.color + '22', color: pres.color, width: 56, height: 56, borderRadius: 16 }}>
            <Icon name={pres.icon} size={28} />
          </div>
          <span className="t-4xl fw7 display" style={{ color: ingreso ? 'var(--success)' : 'var(--text-primary)' }}>
            {ingreso ? '+' : '−'}{NX.fmtCOP(tx.monto)}
          </span>
          <span className="t-base fw5">{tx.comercioOrigen ?? 'Movimiento'}</span>
          <div className="row gap2">
            <Chip tone={ingreso ? 'success' : undefined}>{tx.tipo}</Chip>
            <Chip>{relFecha(tx.fechaHora)}</Chip>
          </div>
        </div>

        {/* clasificación IA */}
        <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 4px 8px' }}>Clasificación IA</div>
        <div className="card">
          <ListRow icon="tag" title="Categoría" rightText={tx.categoria ?? 'Sin categoría'} chevron={false} />
          <ListRow icon="zap" title="Confianza" chevron={false}
            right={<Chip tone={conf >= 90 ? 'success' : conf >= 80 ? 'warning' : 'danger'}>{conf}%</Chip>} />
          <ListRow icon={canalIcon(tx.canal)} title="Canal de origen" rightText={tx.canal} chevron={false} />
          {!tx.legitimo && (
            <ListRow icon="alert-triangle" iconColor="var(--warning)" title="Requiere revisión"
              sub="La IA no está segura de este movimiento" chevron={false} />
          )}
        </div>

        {/* evidencia */}
        {evidence && (
          <>
            <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 4px 8px' }}>Evidencia</div>
            <div className="card card-pad col gap2">
              <div className="row gap2 t-sm fw6">
                <Icon name={tx.canal === 'OCR' ? 'camera' : 'mail'} size={16} color="var(--accent)" />
                {evidence.fromAddr ?? 'Origen'}
              </div>
              <span className="t-sm fw5">{evidence.subject ?? 'Sin asunto'}</span>
              <p className="t-sm tsec mono" style={{ margin: 0, padding: 12, background: 'var(--bg-base)', borderRadius: 'var(--r-md)', lineHeight: 1.6, textWrap: 'pretty' }}>
                {evidence.rawExcerpt ?? '—'}
              </p>
            </div>
          </>
        )}

        <div className="row between card card-pad" style={{ marginTop: 16 }}>
          <span className="t-sm fw5">Marcar como recurrente</span>
          <Toggle on={recurring} onChange={setRecurring} />
        </div>
      </div>

      {/* sticky actions */}
      <div className="row gap3" style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
        <Btn variant="destructive" size="lg" full onClick={() => resolve(false)} disabled={busy}>Rechazar</Btn>
        <Btn variant="primary" size="lg" full icon="check" onClick={() => resolve(true)} disabled={busy}>Aprobar</Btn>
      </div>
    </div>
  );
}

export { FinanzasScreen, DraftDetail };
