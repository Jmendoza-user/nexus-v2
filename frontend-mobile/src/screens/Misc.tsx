// ============================================================
// NEXUS — Upgrade · Notificaciones · Drawer
// ============================================================
import { useState, useEffect } from 'react';
import { Avatar, Btn, Chip, IconBtn, ListRow, TopBar, QuotaRow } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import { api, type NotificationView } from '../lib/api';
import type { Nav } from './types';

type Any = any;

/** Icono + tono por kind de notificación (cae a 'bell' / 'accent'). */
const NOTIF_META: Record<string, { icon: string; tone: string }> = {
  monitor: { icon: 'bell', tone: 'warning' },
  autocure: { icon: 'wrench', tone: 'accent' },
  system: { icon: 'info', tone: 'info' },
};
const notifMeta = (kind: string) => NOTIF_META[kind] ?? { icon: 'bell', tone: 'accent' };

/** Agrupa por etiqueta de día relativa (Hoy / Ayer / fecha). */
function dayLabel(iso: string | null): string {
  if (!iso) return 'Antes';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay) return 'Hoy';
  if (d.toDateString() === yest.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function UpgradeScreen({ nav }: { nav: Nav }) {
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Planes" right={<span style={{ width: 44 }} />} />
      <div className="grow anim-screen" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="col gap2" style={{ padding: '4px 4px 18px', textAlign: 'center', alignItems: 'center' }}>
          <h1 className="t-2xl fw7" style={{ margin: 0 }}>Mejora tu NEXUS</h1>
          <p className="t-sm tsec" style={{ margin: 0, maxWidth: 280 }}>J4 cubre el costo de IA en los planes pagos. Cambia cuando quieras.</p>
        </div>
        <div className="col gap3">
          {NX.plans.map((p: Any) => (
            <div key={p.id} className="card card-pad col gap3" style={{ position: 'relative', borderColor: p.popular ? 'var(--accent)' : 'var(--border-subtle)', boxShadow: p.popular ? '0 0 0 1px var(--accent), var(--shadow-card)' : 'var(--shadow-card)' }}>
              {p.popular && <span className="chip accent" style={{ position: 'absolute', top: -11, left: 16, height: 22 }}><Icon name="sparkles" size={12} /> Recomendado</span>}
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div className="col gap1">
                  <span className="t-lg fw7">{p.name}</span>
                  <span className="t-xs tsec">{p.model}</span>
                </div>
                <div className="col" style={{ alignItems: 'flex-end' }}>
                  <span className="t-2xl fw7 display">{p.price}</span>
                  <span className="t-xs tsec">{p.period}</span>
                </div>
              </div>
              <div className="col gap2">
                {p.features.map((f: string) => (
                  <div key={f} className="row gap2 t-sm">
                    <Icon name="check" size={16} color={p.popular ? 'var(--accent)' : 'var(--success)'} sw={2.4} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Btn variant={p.current ? 'secondary' : p.popular ? 'primary' : 'secondary'} size="lg" full
                onClick={() => p.current ? null : nav.toast(`Abriendo MercadoPago…`, 'credit-card', 'accent')}
                style={p.current ? { pointerEvents: 'none', opacity: 0.7 } : {}}>
                {p.current ? '✓ Tu plan actual' : p.cta}
              </Btn>
            </div>
          ))}
        </div>
        <p className="t-xs tter center" style={{ textAlign: 'center', marginTop: 18, textWrap: 'pretty' }}>Pagos seguros vía MercadoPago en COP o USD. Sin permanencia.</p>
      </div>
    </div>
  );
}

function NotifsScreen({ nav }: { nav: Nav }) {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await api.notifications();
      setItems(res.notifications);
    } catch { /* deja lista vacía */ } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function markAllRead() {
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    await Promise.all(unread.map((n) => api.markNotificationRead(n.id).catch(() => {})));
    nav.toast('Marcadas como leídas', 'check', 'success');
    void refresh();
  }

  // Agrupa por día relativo preservando orden (la API ya viene desc).
  const groups: { day: string; items: NotificationView[] }[] = [];
  for (const n of items) {
    const day = dayLabel(n.createdAt);
    let g = groups.find((x) => x.day === day);
    if (!g) { g = { day, items: [] }; groups.push(g); }
    g.items.push(n);
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Notificaciones" right={<IconBtn name="check" onClick={() => { void markAllRead(); }} />} />
      <div className="grow anim-screen" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        {loading ? (
          <p className="t-sm tsec" style={{ padding: '8px 4px' }}>Cargando…</p>
        ) : groups.length === 0 ? (
          <div className="col center gap3" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div className="lrow-ic" style={{ width: 56, height: 56 }}><Icon name="bell" size={26} /></div>
            <span className="t-base fw6">Sin notificaciones</span>
            <p className="t-sm tsec" style={{ margin: 0, maxWidth: 260 }}>Tus monitores y agentes te avisarán aquí cuando algo cambie.</p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.day} style={{ marginBottom: 18 }}>
              <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 4px 10px' }}>{g.day}</div>
              <div className="col gap3">
                {g.items.map((it) => {
                  const meta = notifMeta(it.kind);
                  return (
                    <div key={it.id} className="card card-pad row gap3" style={{ alignItems: 'flex-start', opacity: it.read ? 0.62 : 1 }}
                      onClick={() => { if (!it.read) { void api.markNotificationRead(it.id).then(refresh).catch(() => {}); } }}>
                      <div className="lrow-ic" style={{ width: 38, height: 38, color: `var(--${meta.tone})`, background: 'var(--bg-elevated)' }}><Icon name={meta.icon} size={18} /></div>
                      <div className="grow col" style={{ gap: 3 }}>
                        <span className="t-sm fw6" style={{ textWrap: 'pretty' }}>{it.title}</span>
                        {it.body && <span className="t-xs tsec" style={{ whiteSpace: 'pre-line' }}>{it.body}</span>}
                        <span className="t-xs tter">{timeLabel(it.createdAt)}</span>
                      </div>
                      {!it.read && <span className="badge-dot" style={{ position: 'static' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Drawer (profile / quick links) slides from left
function Drawer({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: Nav }) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))); }
    else { setShow(false); const t = setTimeout(() => setMounted(false), 320); return () => clearTimeout(t); }
  }, [open]);
  if (!mounted) return null;
  return (
    <>
      <div className={`sheet-backdrop${show ? ' show' : ''}`} onClick={onClose} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '82%', maxWidth: 320, zIndex: 90, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-strong)', transform: show ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .3s var(--ease)', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="col gap3" style={{ padding: '52px 20px 20px' }}>
          <Avatar name={NX.user.name} size={56} />
          <div className="col gap1">
            <span className="t-lg fw7">{NX.user.name}</span>
            <span className="t-xs tsec">{NX.user.email}</span>
          </div>
          <Chip tone="accent" icon="sparkles" style={{ alignSelf: 'flex-start' }}>Plan {NX.user.plan}</Chip>
        </div>
        <div className="card card-pad col gap3" style={{ margin: '0 16px 16px' }}>
          <span className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uso de mayo</span>
          {NX.usage.slice(0, 2).map((u: Any) => <QuotaRow key={u.label} {...u} />)}
        </div>
        <div className="grow" style={{ overflowY: 'auto' }}>
          <ListRow icon="crown" title="Plan y facturación" onClick={() => { onClose(); setTimeout(() => nav.push('upgrade'), 60); }} />
          <ListRow icon="bot" title="Mis agentes" onClick={() => { onClose(); setTimeout(() => nav.push('agentes'), 60); }} />
          <ListRow icon="shield-check" title="Seguridad" onClick={() => { onClose(); setTimeout(() => nav.push('seguridad'), 60); }} />
          <ListRow icon="settings" title="Preferencias" onClick={() => { onClose(); setTimeout(() => nav.push('preferencias'), 60); }} />
        </div>
        <button className="btn btn-ghost btn-md" style={{ color: 'var(--danger)', margin: 16, justifyContent: 'flex-start' }}>
          <Icon name="log-out" size={18} /> Cerrar sesión
        </button>
      </div>
    </>
  );
}

export { UpgradeScreen, NotifsScreen, Drawer };
