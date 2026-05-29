// ============================================================
// NEXUS — Upgrade · Notificaciones · Drawer
// ============================================================
import { useState, useEffect } from 'react';
import { Avatar, Btn, Chip, IconBtn, ListRow, TopBar, QuotaRow } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import {
  api,
  BillingNotConfiguredError,
  type MeResponse,
  type UsageResponse,
  type NotificationView,
  type PlanView,
  type SubscriptionView,
} from '../lib/api';
import type { Nav } from './types';

// Mapea una cuota real (UsageResponse) a props de QuotaRow.
function drawerQuota(q: UsageResponse['quotas'][number]): { label: string; icon: string; used: number; total: number; unit: string } {
  if (q.metric === 'voice_seconds') return { label: 'Voz', icon: 'mic', used: Math.round(q.used / 60), total: Math.round(q.limit / 60), unit: 'min' };
  if (q.metric === 'vault_bytes') return { label: 'Vault', icon: 'book-open', used: Math.round(q.used / 1048576), total: Math.round(q.limit / 1048576), unit: 'MB' };
  return { label: 'Mensajes IA', icon: 'message-circle', used: q.used, total: q.limit, unit: '' };
}

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

/** Formatea el precio de un plan para el encabezado de la card. */
function planPrice(p: PlanView): { price: string; period: string } {
  if (p.priceCop <= 0) return { price: '$0', period: 'siempre' };
  return { price: '$' + p.priceCop.toLocaleString('es-CO'), period: '/ mes · COP' };
}

const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, team: 2 };

function UpgradeScreen({ nav }: { nav: Nav }) {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [mpConfigured, setMpConfigured] = useState(false);
  const [canSimulate, setCanSimulate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      const [pl, su] = await Promise.all([api.plans(), api.subscription()]);
      setPlans(pl.plans);
      setMpConfigured(pl.mpConfigured);
      setSub(su.subscription);
    } catch { /* deja vacío */ } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  const currentTier = sub?.tier ?? 'free';

  async function change(tier: 'pro' | 'team', simulate: boolean) {
    if (busy) return;
    setBusy(tier);
    try {
      const res = await api.checkout(tier, simulate);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl; // MP real
        return;
      }
      if (res.simulated) {
        nav.toast(`Plan cambiado a ${tier === 'pro' ? 'Pro' : 'Team'}`, 'check-circle', 'success');
        await refresh();
      }
    } catch (err) {
      if (err instanceof BillingNotConfiguredError) {
        setCanSimulate(err.canSimulate);
        nav.toast('Pagos próximamente', 'clock', 'accent');
      } else {
        nav.toast('No se pudo iniciar el cambio', 'x-circle', 'danger');
      }
    } finally {
      setBusy(null);
    }
  }

  // El botón "Simular cambio" solo aparece si el backend lo permite (dev) y MP
  // aún no está configurado. Se descubre tras un primer intento de checkout o
  // si el catálogo dice que MP no está activo.
  const simulationAvailable = !mpConfigured && canSimulate;
  const isPaidPlan = currentTier === 'pro' || currentTier === 'team';

  async function cancel() {
    if (busy) return;
    setBusy('cancel');
    try {
      const res = await api.cancelPlan();
      setSub(res.subscription);
      nav.toast('Tu plan se cancelará al fin del periodo', 'check-circle', 'success');
    } catch {
      nav.toast('No se pudo cancelar el plan', 'x-circle', 'danger');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title="Planes" right={<span style={{ width: 44 }} />} />
      <div className="grow anim-screen" style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
        <div className="col gap2" style={{ padding: '4px 4px 18px', textAlign: 'center', alignItems: 'center' }}>
          <h1 className="t-2xl fw7" style={{ margin: 0 }}>Mejora tu NEXUS</h1>
          <p className="t-sm tsec" style={{ margin: 0, maxWidth: 280 }}>J4 cubre el costo de IA en los planes pagos. Cambia cuando quieras.</p>
        </div>
        {loading ? (
          <p className="t-sm tsec" style={{ padding: '8px 4px', textAlign: 'center' }}>Cargando planes…</p>
        ) : (
          <div className="col gap3">
            {plans.map((p) => {
              const isCurrent = p.tier === currentTier;
              const { price, period } = planPrice(p);
              const isUpgrade = (TIER_ORDER[p.tier] ?? 0) > (TIER_ORDER[currentTier] ?? 0);
              const ctaLabel = isCurrent ? 'Tu plan actual' : isUpgrade ? `Cambiar a ${p.name}` : `Bajar a ${p.name}`;
              const isPaid = p.priceCop > 0;
              return (
                <div key={p.tier} className="card card-pad col gap3" style={{ position: 'relative', borderColor: p.popular ? 'var(--accent)' : 'var(--border-subtle)', boxShadow: p.popular ? '0 0 0 1px var(--accent), var(--shadow-card)' : 'var(--shadow-card)' }}>
                  {p.popular && <span className="chip accent" style={{ position: 'absolute', top: -11, left: 16, height: 22 }}><Icon name="sparkles" size={12} /> Recomendado</span>}
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div className="col gap1">
                      <span className="t-lg fw7">{p.name}</span>
                      <span className="t-xs tsec">USD ${p.priceUsd} aprox.</span>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end' }}>
                      <span className="t-2xl fw7 display">{price}</span>
                      <span className="t-xs tsec">{period}</span>
                    </div>
                  </div>
                  <div className="col gap2">
                    {p.features.map((f) => (
                      <div key={f} className="row gap2 t-sm">
                        <Icon name="check" size={16} color={p.popular ? 'var(--accent)' : 'var(--success)'} sw={2.4} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrent ? (
                    <Btn variant="secondary" size="lg" full style={{ pointerEvents: 'none', opacity: 0.7 }}>
                      <Icon name="check" size={18} /> Tu plan actual
                    </Btn>
                  ) : !isPaid ? (
                    <Btn variant="secondary" size="lg" full disabled={busy !== null}
                      onClick={() => change('pro', simulationAvailable)} style={{ visibility: 'hidden' }}>—</Btn>
                  ) : (
                    <div className="col gap2">
                      <Btn variant={p.popular ? 'primary' : 'secondary'} size="lg" full disabled={busy !== null}
                        onClick={() => change(p.tier as 'pro' | 'team', false)}>
                        {busy === p.tier ? 'Procesando…' : ctaLabel}
                      </Btn>
                      {simulationAvailable && (
                        <Btn variant="ghost" size="sm" full disabled={busy !== null}
                          onClick={() => change(p.tier as 'pro' | 'team', true)}>
                          <Icon name="zap" size={15} /> Simular cambio (dev)
                        </Btn>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loading && isPaidPlan && (
          sub?.cancelAtPeriodEnd ? (
            <p className="t-xs tter center" style={{ textAlign: 'center', marginTop: 16 }}>
              Tu plan {TIER_LABEL_UP[currentTier]} se cancelará al fin del periodo.
            </p>
          ) : (
            <button className="btn btn-ghost btn-md btn-block" style={{ color: 'var(--danger)', marginTop: 12 }}
              disabled={busy !== null} onClick={() => { void cancel(); }}>
              {busy === 'cancel' ? 'Cancelando…' : 'Cancelar plan'}
            </button>
          )
        )}
        <p className="t-xs tter center" style={{ textAlign: 'center', marginTop: 18, textWrap: 'pretty' }}>
          {mpConfigured ? 'Pagos seguros vía MercadoPago en COP o USD. Sin permanencia.' : 'Pagos vía MercadoPago próximamente. Sin permanencia.'}
        </p>
      </div>
    </div>
  );
}

const TIER_LABEL_UP: Record<string, string> = { free: 'Free', pro: 'Pro', team: 'Team' };

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
  const [me, setMe] = useState<MeResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))); }
    else { setShow(false); const t = setTimeout(() => setMounted(false), 320); return () => clearTimeout(t); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (!me) api.me().then(setMe).catch(() => {});
    if (!usage) api.usage().then(setUsage).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted) return null;
  const name = me?.user.displayName ?? '';
  const email = me?.user.email ?? '';
  const planLabel = me?.tier ? me.tier.charAt(0).toUpperCase() + me.tier.slice(1) : '—';
  async function logout() {
    try { await api.logout(); } catch { /* noop */ }
    window.location.href = '/';
  }
  return (
    <>
      <div className={`sheet-backdrop${show ? ' show' : ''}`} onClick={onClose} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '82%', maxWidth: 320, zIndex: 90, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-strong)', transform: show ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .3s var(--ease)', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="col gap3" style={{ padding: '52px 20px 20px' }}>
          <Avatar name={name} size={56} />
          <div className="col gap1">
            <span className="t-lg fw7">{name}</span>
            <span className="t-xs tsec">{email}</span>
          </div>
          <Chip tone="accent" icon="sparkles" style={{ alignSelf: 'flex-start' }}>Plan {planLabel}</Chip>
        </div>
        <div className="card card-pad col gap3" style={{ margin: '0 16px 16px' }}>
          <span className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uso del mes</span>
          {usage
            ? usage.quotas.slice(0, 2).map((q) => { const m = drawerQuota(q); return <QuotaRow key={m.label} {...m} />; })
            : <span className="t-sm tsec">Cargando…</span>}
        </div>
        <div className="grow" style={{ overflowY: 'auto' }}>
          <ListRow icon="crown" title="Plan y facturación" onClick={() => { onClose(); setTimeout(() => nav.push('upgrade'), 60); }} />
          <ListRow icon="bot" title="Mis agentes" onClick={() => { onClose(); setTimeout(() => nav.push('agentes'), 60); }} />
          <ListRow icon="shield-check" title="Seguridad" onClick={() => { onClose(); setTimeout(() => nav.push('seguridad'), 60); }} />
          <ListRow icon="settings" title="Preferencias" onClick={() => { onClose(); setTimeout(() => nav.push('preferencias'), 60); }} />
        </div>
        <button className="btn btn-ghost btn-md" style={{ color: 'var(--danger)', margin: 16, justifyContent: 'flex-start' }} onClick={() => void logout()}>
          <Icon name="log-out" size={18} /> Cerrar sesión
        </button>
      </div>
    </>
  );
}

export { UpgradeScreen, NotifsScreen, Drawer };
