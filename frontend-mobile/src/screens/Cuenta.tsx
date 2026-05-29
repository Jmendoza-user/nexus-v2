// ============================================================
// NEXUS — Cuenta (/m/cuenta) + Config (principal, conexiones,
// seguridad, skills)
// ============================================================
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Avatar, Btn, Chip, IconBtn, ListRow, TopBar, QuotaRow, Toggle } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import {
  api,
  type TelegramPairResponse,
  type SkillCatalogEntry,
  type SkillInstallation,
  type ConnectionView,
  type ConnectionProvider,
  type UserProfile,
  type UsageResponse,
  type SubscriptionView,
} from '../lib/api';
import type { Nav } from './types';

type Any = any;

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', team: 'Team' };

function CuentaScreen({ nav }: { nav: Nav }) {
  const [unread, setUnread] = useState(0);
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  useEffect(() => {
    api.notifications().then((r) => setUnread(r.unread)).catch(() => setUnread(0));
    api.subscription().then((r) => setSub(r.subscription)).catch(() => setSub(null));
  }, []);
  const planName = sub ? (TIER_LABEL[sub.tier] ?? sub.tier) : NX.user.plan;
  const billingSub = sub
    ? sub.cancelAtPeriodEnd
      ? 'Se cancela al fin del periodo'
      : sub.currentPeriodEnd
        ? `${planName} · renueva ${new Date(sub.currentPeriodEnd).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
        : `Plan ${planName}`
    : 'Plan y facturación';
  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Cuenta</span>
        <IconBtn name="bell" badge={unread > 0} onClick={() => nav.push('notifs')} />
      </div>
      <div className="grow" style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
        {/* profile */}
        <div className="col center gap3" style={{ padding: '8px 0 20px', textAlign: 'center' }}>
          <Avatar name={NX.user.name} size={76} />
          <div className="col gap1" style={{ alignItems: 'center' }}>
            <h1 className="t-2xl fw7" style={{ margin: 0 }}>{NX.user.name}</h1>
            <span className="t-sm tsec">{NX.user.email}</span>
          </div>
          <div className="row gap2">
            <Chip tone="accent" icon="sparkles">Plan {planName}</Chip>
            <Chip>{NX.user.org}</Chip>
          </div>
        </div>

        {/* usage */}
        <div className="card card-pad col gap4" style={{ marginBottom: 20 }}>
          <div className="row between">
            <span className="t-sm fw6">Uso de mayo</span>
            <button className="btn btn-ghost btn-sm" style={{ paddingRight: 0 }} onClick={() => nav.push('uso')}>Ver detalle</button>
          </div>
          {NX.usage.map((u: Any) => <QuotaRow key={u.label} {...u} />)}
        </div>

        {/* sections */}
        <div className="card" style={{ marginBottom: 16 }}>
          <ListRow icon="sparkles" title="Asistente principal" sub="Prompt, tono, voz" onClick={() => nav.push('principal')} />
          <ListRow icon="bot" title="Mis agentes" sub="3 agentes activos" onClick={() => nav.push('agentes')} />
          <ListRow icon="wrench" title="Skills y MCPs" sub="6 instaladas" onClick={() => nav.push('skills')} />
          <ListRow icon="link" title="Conexiones" sub="Gmail, Calendar, Telegram…" onClick={() => nav.push('conexiones')} />
          <ListRow icon="shield-check" title="Seguridad y privacidad" sub="Token Guard activo" onClick={() => nav.push('seguridad')} />
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <ListRow icon="crown" title="Plan y facturación" sub={billingSub} onClick={() => nav.push('upgrade')} />
          <ListRow icon="settings" title="Preferencias" sub="Idioma, tema, notificaciones" onClick={() => nav.push('preferencias')} />
        </div>

        <button className="btn btn-ghost btn-md btn-block" style={{ color: 'var(--danger)' }}>
          <Icon name="log-out" size={18} /> Cerrar sesión
        </button>
        <p className="t-xs tter center" style={{ textAlign: 'center', marginTop: 18 }}>NEXUS V2.0 · user_001 · J4 Smart Solutions</p>
      </div>
    </div>
  );
}

// ---- Asistente principal ----
const VOICES = [
  { id: 'elisa-maria', label: 'Elisa María' },
  { id: 'mateo', label: 'Mateo' },
  { id: 'valentina', label: 'Valentina' },
];
const DEFAULT_PROMPT =
  'Eres el asistente personal de NEXUS. Tono neutro-cercano, respuestas concisas, sin filler. Español LATAM, tuteo.';

function ConfigPrincipal({ nav }: { nav: Nav }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prompt, setPrompt] = useState('');
  const [voice, setVoice] = useState('elisa-maria');
  const [saving, setSaving] = useState(false);
  const [proact, setProact] = useState(3);

  useEffect(() => {
    api.profile().then(({ user }) => {
      setProfile(user);
      setPrompt(user.primaryAgentPrompt ?? DEFAULT_PROMPT);
    }).catch(() => setPrompt(DEFAULT_PROMPT));
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await api.updateProfile({ primaryAgentPrompt: prompt.trim() || DEFAULT_PROMPT });
      nav.toast('Asistente actualizado', 'check-circle', 'success');
    } catch {
      nav.toast('No se pudo guardar', 'x-circle', 'danger');
    } finally {
      setSaving(false);
    }
  }

  function adjustTone(suffix: string) {
    setPrompt((p) => (p ? `${p}\n${suffix}` : suffix));
  }

  return (
    <ConfigShell nav={nav} title="Asistente principal">
      <div className="t-xs tter fw6 cap" style={cfgLbl}>System prompt</div>
      <div className="card card-pad">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="t-sm tsec mono"
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', lineHeight: 1.6, color: 'var(--text-secondary)' }}
          placeholder={DEFAULT_PROMPT}
        />
      </div>
      <div className="row gap2 wrap" style={{ margin: '12px 0 4px' }}>
        {[
          ['Más formal', 'Usa un tono más formal y profesional.'],
          ['Más casual', 'Usa un tono más casual y relajado.'],
          ['Más conciso', 'Sé aún más conciso: una o dos frases.'],
        ].map(([label, suffix]) => (
          <button key={label} className="chip" style={{ cursor: 'pointer', height: 32 }} onClick={() => adjustTone(suffix)}>{label}</button>
        ))}
      </div>

      <div className="t-xs tter fw6 cap" style={cfgLbl}>Voz</div>
      <div className="card">
        {VOICES.map((v) => (
          <div key={v.id} className="lrow" onClick={() => setVoice(v.id)}>
            <div className="lrow-ic"><Icon name="volume-2" size={18} /></div>
            <span className="grow t-base fw5">{v.label}</span>
            <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={(e) => { e.stopPropagation(); nav.toast('Reproduciendo muestra…', 'play', 'accent'); }}><Icon name="play" size={16} /></button>
            {voice === v.id && <Icon name="check" size={18} color="var(--accent)" />}
          </div>
        ))}
      </div>

      <div className="t-xs tter fw6 cap" style={cfgLbl}>Proactividad</div>
      <div className="card card-pad col gap3">
        <input type="range" min="1" max="5" value={proact} onChange={e => setProact(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--accent)' }} />
        <div className="row between t-xs tter"><span>Reactivo</span><span className="tacc fw6">Nivel {proact}</span><span>Muy proactivo</span></div>
        <p className="t-sm tsec" style={{ margin: 0 }}>{proact <= 2 ? 'Solo responde cuando le hablas.' : proact >= 4 ? 'Se anticipa: te avisa de borradores, tareas y rutinas sin que preguntes.' : 'Sugiere acciones relevantes en momentos clave.'}</p>
      </div>

      <Btn variant="primary" size="md" full style={{ marginTop: 18 }} onClick={() => { void save(); }} disabled={saving || !profile}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </Btn>
    </ConfigShell>
  );
}

// ---- Skills ----
/** Mapa key→icono Lucide (cae a 'wrench' si no hay coincidencia). */
const SKILL_ICONS: Record<string, string> = {
  'buscador-web': 'globe',
  'lector-pdf': 'file-text',
  resumidor: 'list-checks',
  'agenda-google': 'calendar',
  'finanzas-gmail': 'wallet',
  'generador-imagenes': 'camera',
  'rag-vault': 'brain',
  'ocr-tirillas': 'camera',
};
const skillIcon = (key: string): string => SKILL_ICONS[key] ?? 'wrench';

type SkillState = 'installed' | 'available' | 'installing' | 'repairing';

function ConfigSkills({ nav }: { nav: Nav }) {
  const [catalog, setCatalog] = useState<SkillCatalogEntry[]>([]);
  const [installed, setInstalled] = useState<SkillInstallation[]>([]);
  const [busy, setBusy] = useState<Record<string, SkillState>>({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [cat, inst] = await Promise.all([api.skillsCatalog(), api.skillsInstalled()]);
    setCatalog(cat.catalog);
    setInstalled(inst.installed);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  const installedKeys = new Map(installed.map((i) => [i.skillKey, i]));

  async function install(entry: SkillCatalogEntry) {
    setBusy((b) => ({ ...b, [entry.key]: 'installing' }));
    nav.toast(`Instalando ${entry.name}…`, 'download', 'accent');
    try {
      await api.installSkill(entry.key);
      nav.toast(`${entry.name} instalada`, 'check-circle', 'success');
      await refresh();
    } catch {
      nav.toast(`No se pudo instalar ${entry.name}`, 'x-circle', 'danger');
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[entry.key]; return n; });
    }
  }

  async function uninstall(entry: SkillCatalogEntry) {
    setBusy((b) => ({ ...b, [entry.key]: 'installing' }));
    try {
      await api.uninstallSkill(entry.key);
      nav.toast(`${entry.name} desinstalada`, 'check-circle', 'success');
      await refresh();
    } catch {
      nav.toast(`No se pudo desinstalar ${entry.name}`, 'x-circle', 'danger');
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[entry.key]; return n; });
    }
  }

  const installedEntries = catalog.filter((c) => installedKeys.has(c.key));
  const availableEntries = catalog.filter((c) => !installedKeys.has(c.key));

  return (
    <ConfigShell nav={nav} title="Skills y MCPs">
      {loading ? (
        <p className="t-sm tsec" style={{ padding: '8px 4px' }}>Cargando…</p>
      ) : (
        <>
          <div className="t-xs tter fw6 cap" style={cfgLbl}>Instaladas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {installedEntries.length === 0 && <p className="t-sm tsec" style={{ gridColumn: '1 / -1', margin: 0 }}>Aún no tienes skills instaladas.</p>}
            {installedEntries.map((c) => (
              <SkillCard key={c.key} entry={c} install={installedKeys.get(c.key)!} state={busy[c.key] ?? 'installed'} onAction={() => uninstall(c)} />
            ))}
          </div>
          <div className="t-xs tter fw6 cap" style={cfgLbl}>Disponibles</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {availableEntries.map((c) => (
              <SkillCard key={c.key} entry={c} install={null} state={busy[c.key] ?? 'available'} onAction={() => install(c)} />
            ))}
          </div>
        </>
      )}
    </ConfigShell>
  );
}

function SkillCard({ entry, install, state, onAction }: { entry: SkillCatalogEntry; install: SkillInstallation | null; state: SkillState; onAction: () => void }) {
  const isInstalled = Boolean(install) && state !== 'installing';
  const isRepairing = install?.status === 'repairing' || state === 'repairing';
  const isBusy = state === 'installing';
  return (
    <div className="card card-pad col gap2" style={{ cursor: isBusy ? 'default' : 'pointer' }} onClick={() => { if (!isBusy) onAction(); }}>
      <div className="row between">
        <div className="lrow-ic" style={{ width: 36, height: 36 }}><Icon name={skillIcon(entry.key)} size={18} /></div>
        {isBusy ? (
          <Chip tone="accent" style={{ height: 20 }}>{install ? 'Quitando…' : 'Instalando…'}</Chip>
        ) : isRepairing ? (
          <Chip tone="warning" style={{ height: 20 }}>Reparando…</Chip>
        ) : install?.source === 'autocure' ? (
          <Chip tone="accent" style={{ height: 20 }}>Auto</Chip>
        ) : isInstalled ? (
          <Icon name="check-circle" size={18} color="var(--success)" />
        ) : (
          <Icon name="download" size={18} color="var(--text-tertiary)" />
        )}
      </div>
      <span className="t-sm fw6">{entry.name}</span>
      <p className="t-xs tsec" style={{ margin: 0, lineHeight: 1.45 }}>{entry.description}</p>
      <span className="t-xs tter mono">{(entry.requiresMcp[0]) ?? 'sin MCP'}</span>
    </div>
  );
}

// ---- Conexiones ----
const PROVIDER_META: Record<ConnectionProvider, { name: string; icon: string; detail: string }> = {
  google: { name: 'Google', icon: 'globe', detail: 'Gmail, Calendar y Drive' },
  gmail: { name: 'Gmail', icon: 'mail', detail: 'Lectura de movimientos' },
  gcal: { name: 'Google Calendar', icon: 'calendar', detail: 'Eventos y agenda' },
  meta: { name: 'Meta / Instagram', icon: 'camera', detail: 'Publicaciones' },
  telegram: { name: 'Telegram', icon: 'send', detail: '@NexusJ4Bot' },
  mercadopago: { name: 'MercadoPago', icon: 'credit-card', detail: 'Para facturación' },
};
const STATUS_LABEL: Record<ConnectionView['status'], { text: string; tone: string }> = {
  active: { text: 'Conectado', tone: 'success' },
  disconnected: { text: 'Desconectado', tone: 'text-tertiary' },
  expired: { text: 'Expirado', tone: 'warning' },
  pending: { text: 'Pendiente', tone: 'warning' },
};

function ConfigConexiones({ nav }: { nav: Nav }) {
  const [conns, setConns] = useState<ConnectionView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await api.connections();
    // Telegram tiene su propia tarjeta abajo. gmail/gcal quedan unificados en la
    // conexión 'google' (un solo login → Gmail + Calendar + Drive), no se listan sueltos.
    setConns(res.connections.filter((c) => !['telegram', 'gmail', 'gcal'].includes(c.provider)));
  }
  useEffect(() => { void refresh(); }, []);

  async function connect(provider: ConnectionProvider) {
    setBusy(provider);
    try {
      const { authUrl } = await api.connectionOAuthStart(provider);
      window.location.href = authUrl;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 503) {
        nav.toast('Próximamente', 'clock', 'accent');
      } else {
        nav.toast('No se pudo iniciar la conexión', 'x-circle', 'danger');
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConfigShell nav={nav} title="Conexiones">
      <p className="t-sm tsec" style={{ margin: '0 4px 14px', textWrap: 'pretty' }}>Tus tokens se cifran con AES-256 y se guardan en tu propio VPS. Nunca salen de tu entorno.</p>
      <div className="card">
        {conns.map((c) => {
          const meta = PROVIDER_META[c.provider];
          const st = STATUS_LABEL[c.status];
          const comingSoon = c.provider === 'meta' || c.provider === 'mercadopago';
          return (
            <div key={c.provider} className="lrow" style={{ cursor: 'default' }}>
              <div className="lrow-ic"><Icon name={meta.icon} size={19} /></div>
              <div className="grow col" style={{ gap: 2 }}>
                <span className="t-base fw5">{meta.name}</span>
                <span className="t-xs" style={{ color: `var(--${st.tone})` }}>{st.text} · {meta.detail}</span>
              </div>
              {c.status === 'active' ? (
                <Icon name="check-circle" size={20} color="var(--success)" />
              ) : comingSoon ? (
                <Chip style={{ height: 26 }}>Próximamente</Chip>
              ) : (
                <Btn size="sm" variant="secondary" disabled={busy === c.provider} onClick={() => { void connect(c.provider); }}>
                  {busy === c.provider ? '…' : c.status === 'expired' ? 'Reautorizar' : 'Conectar'}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
      <TelegramPairingCard />
    </ConfigShell>
  );
}

/** Vinculación Telegram real: estado + código bajo demanda. */
function TelegramPairingCard() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [pairing, setPairing] = useState<TelegramPairResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.telegramPairingStatus().then((s) => setLinked(s.linked)).catch(() => setLinked(false));
  }, []);

  async function genCode() {
    if (busy) return;
    setBusy(true);
    try { setPairing(await api.telegramPair()); } catch { /* ignora */ } finally { setBusy(false); }
  }

  return (
    <div className="card card-pad col gap3" style={{ marginTop: 16 }}>
      <div className="row gap2 t-sm fw6"><Icon name="send" size={16} color="var(--accent)" /> Bot de Telegram</div>
      {linked ? (
        <div className="row gap2 t-sm" style={{ color: 'var(--success)' }}>
          <Icon name="check-circle" size={16} color="var(--success)" /> Tu cuenta ya está vinculada a Telegram.
        </div>
      ) : pairing ? (
        <>
          <p className="t-sm tsec" style={{ margin: 0 }}>Escribe <span className="mono tacc">/start</span> a <span className="fw6">@{pairing.botUsername}</span> y pega este código:</p>
          <div className="row center" style={{ gap: 8 }}>
            {pairing.code.split('').map((ch, i) => (
              <span key={i} className="mono t-2xl fw7 card center" style={{ width: 42, height: 52, color: 'var(--accent)' }}>{ch}</span>
            ))}
          </div>
          <span className="t-xs tter center" style={{ textAlign: 'center' }}>Caduca en {Math.round(pairing.ttlSeconds / 60)} min</span>
        </>
      ) : (
        <>
          <p className="t-sm tsec" style={{ margin: 0 }}>Genera un código para vincular tu chat de Telegram con NEXUS.</p>
          <Btn size="sm" variant="secondary" onClick={() => { void genCode(); }} disabled={busy}>{busy ? 'Generando…' : 'Generar código'}</Btn>
        </>
      )}
    </div>
  );
}

// ---- Seguridad ----
function ConfigSeguridad({ nav }: { nav: Nav }) {
  const [tg, setTg] = useState(true);
  return (
    <ConfigShell nav={nav} title="Seguridad y privacidad">
      <div className="card card-pad row between" style={{ marginBottom: 16 }}>
        <div className="row gap3">
          <div className="lrow-ic" style={{ color: 'var(--accent)' }}><Icon name="shield-check" size={20} /></div>
          <div className="col" style={{ gap: 2 }}>
            <span className="t-base fw6">Token Guard</span>
            <span className="t-xs tsec">Oculta PII antes de enviar a la IA</span>
          </div>
        </div>
        <Toggle on={tg} onChange={setTg} />
      </div>

      <div className="t-xs tter fw6 cap" style={cfgLbl}>Últimas redacciones</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {NX.redactions.map((r: Any) => (
          <ListRow key={r.id} icon="lock" title={r.type} sub={r.when} chevron={false}
            right={<span className="mono t-sm tsec">{r.value}</span>} />
        ))}
      </div>

      <div className="card card-pad col gap2" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
        <span className="t-sm fw6" style={{ color: 'var(--danger)' }}>Zona de peligro</span>
        <p className="t-sm tsec" style={{ margin: 0 }}>Esto eliminará tu vault, tus notas, tus conexiones y tus borradores. No se puede deshacer.</p>
        <Btn variant="destructive" size="md" style={{ marginTop: 4, alignSelf: 'flex-start' }} icon="trash">Borrar mi cuenta</Btn>
      </div>
    </ConfigShell>
  );
}

// ---- Preferencias ----
function ConfigPreferencias({ nav, theme, setTheme }: { nav: Nav; theme: string; setTheme: (v: string) => void }) {
  const [notif, setNotif] = useState(true);
  return (
    <ConfigShell nav={nav} title="Preferencias">
      <div className="t-xs tter fw6 cap" style={cfgLbl}>Apariencia</div>
      <div className="card" style={{ marginBottom: 16, padding: 4 }}>
        <div className="seg" style={{ border: 'none', background: 'transparent' }}>
          {[{ v: 'auto', l: 'Auto', i: 'settings' }, { v: 'dark', l: 'Oscuro', i: 'moon' }, { v: 'light', l: 'Claro', i: 'sun' }].map(o => (
            <button key={o.v} className={theme === o.v ? 'on' : ''} onClick={() => setTheme(o.v)}><Icon name={o.i} size={15} />{o.l}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <ListRow icon="globe" title="Idioma" rightText="Español (CO)" chevron />
        <div className="lrow" style={{ cursor: 'default' }}>
          <div className="lrow-ic"><Icon name="bell" size={19} /></div>
          <span className="grow t-base fw5">Notificaciones push</span>
          <Toggle on={notif} onChange={setNotif} />
        </div>
        <ListRow icon="send" title="Notificaciones por Telegram" rightText="Activas" chevron />
      </div>
    </ConfigShell>
  );
}

// ---- Uso detalle (cableado a /api/usage) ----
const METRIC_META: Record<string, { label: string; icon: string; fmt: (n: number) => { used: number; total: number; unit: string } }> = {
  messages: { label: 'Mensajes IA', icon: 'message-circle', fmt: (n) => ({ used: n, total: 0, unit: '' }) },
  voice_seconds: { label: 'Voz', icon: 'mic', fmt: (n) => ({ used: Math.round(n / 60), total: 0, unit: 'min' }) },
  vault_bytes: { label: 'Vault', icon: 'book-open', fmt: (n) => ({ used: Math.round(n / (1024 * 1024)), total: 0, unit: 'MB' }) },
};

function fmtMetric(metric: string, used: number, limit: number): { label: string; icon: string; used: number; total: number; unit: string } {
  const meta = METRIC_META[metric] ?? { label: metric, icon: 'activity', fmt: (n: number) => ({ used: n, total: 0, unit: '' }) };
  if (metric === 'voice_seconds') return { label: meta.label, icon: meta.icon, used: Math.round(used / 60), total: Math.round(limit / 60), unit: 'min' };
  if (metric === 'vault_bytes') return { label: meta.label, icon: meta.icon, used: Math.round(used / (1024 * 1024)), total: Math.round(limit / (1024 * 1024)), unit: 'MB' };
  return { label: meta.label, icon: meta.icon, used, total: limit, unit: '' };
}

function UsoScreen({ nav }: { nav: Nav }) {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.usage().then((u) => { setUsage(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const rows = usage ? usage.quotas.map((q) => fmtMetric(q.metric, q.used, q.limit)) : [];
  const msgQuota = usage?.quotas.find((q) => q.metric === 'messages');
  const nearLimit = msgQuota ? msgQuota.limit > 0 && msgQuota.used / msgQuota.limit >= 0.8 : false;
  const savings = usage?.ai.savings;

  return (
    <ConfigShell nav={nav} title="Uso del mes">
      {loading ? (
        <p className="t-sm tsec" style={{ padding: '8px 4px' }}>Cargando…</p>
      ) : (
        <>
          <div className="card card-pad col gap5" style={{ marginBottom: 16 }}>
            {rows.length === 0 && <p className="t-sm tsec" style={{ margin: 0 }}>Sin datos de uso todavía.</p>}
            {rows.map((u) => <QuotaRow key={u.label} {...u} />)}
          </div>

          {/* Ahorro por caché semántico (Token Guard etapa 2) */}
          <div className="t-xs tter fw6 cap" style={cfgLbl}>Inteligencia y ahorro</div>
          <div className="card card-pad col gap3" style={{ marginBottom: 16 }}>
            <div className="row between">
              <div className="row gap2 t-sm"><Icon name="zap" size={16} color="var(--accent)" /> Llamadas a IA</div>
              <span className="t-sm fw6">{usage?.ai.totalCalls ?? 0}</span>
            </div>
            <div className="row between">
              <div className="row gap2 t-sm"><Icon name="database" size={16} color="var(--text-secondary)" /> Tokens estimados</div>
              <span className="t-sm fw6 mono">{(usage?.ai.totalTokens ?? 0).toLocaleString('es-CO')}</span>
            </div>
            <div className="row between">
              <div className="row gap2 t-sm" style={{ color: 'var(--success)' }}><Icon name="shield-check" size={16} color="var(--success)" /> Ahorrado por caché</div>
              <span className="t-sm fw6" style={{ color: 'var(--success)' }}>
                {(savings?.cacheHits ?? 0)} hits · ${ (savings?.usdSaved ?? 0).toFixed(3) }
              </span>
            </div>
          </div>

          {nearLimit && (
            <div className="card card-pad col gap2" style={{ borderColor: 'var(--warning)' }}>
              <div className="row gap2 t-sm fw6" style={{ color: 'var(--warning)' }}><Icon name="alert-triangle" size={16} /> Cerca del límite</div>
              <p className="t-sm tsec" style={{ margin: 0 }}>Llevas {msgQuota!.used} de {msgQuota!.limit} mensajes este mes.</p>
              <Btn size="md" variant="primary" icon="crown" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => nav.push('upgrade')}>Ampliar cupo</Btn>
            </div>
          )}
        </>
      )}
    </ConfigShell>
  );
}

// Shared config shell
const cfgLbl: CSSProperties = { textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 4px 10px' };
function ConfigShell({ nav, title, children }: Any) {
  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar left={<IconBtn name="arrow-left" onClick={() => nav.back()} />} title={title} right={<span style={{ width: 44 }} />} />
      <div className="grow anim-screen" style={{ overflowY: 'auto', padding: '8px 16px 32px' }}>{children}</div>
    </div>
  );
}

export { CuentaScreen, ConfigPrincipal, ConfigSkills, ConfigConexiones, ConfigSeguridad, ConfigPreferencias, UsoScreen };
