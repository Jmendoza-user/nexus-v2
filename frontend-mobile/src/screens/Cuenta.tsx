// ============================================================
// NEXUS — Cuenta (/m/cuenta) + Config (principal, conexiones,
// seguridad, skills)
// ============================================================
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Avatar, Btn, Chip, IconBtn, ListRow, TopBar, QuotaRow, Toggle } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import type { Nav } from './types';

type Any = any;

function CuentaScreen({ nav }: { nav: Nav }) {
  return (
    <div className="col" style={{ height: '100%' }}>
      <div className="topbar">
        <span className="t-base fw6">Cuenta</span>
        <IconBtn name="bell" badge onClick={() => nav.push('notifs')} />
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
            <Chip tone="accent" icon="sparkles">Plan {NX.user.plan}</Chip>
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
          <ListRow icon="crown" title="Plan y facturación" sub="Pro · próxima factura 28 jun" onClick={() => nav.push('upgrade')} />
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
function ConfigPrincipal({ nav }: { nav: Nav }) {
  const [voice, setVoice] = useState('Elisa María');
  const [proact, setProact] = useState(3);
  return (
    <ConfigShell nav={nav} title="Asistente principal">
      <div className="t-xs tter fw6 cap" style={cfgLbl}>System prompt</div>
      <div className="card card-pad">
        <p className="t-sm tsec mono" style={{ margin: 0, lineHeight: 1.6 }}>Eres el asistente personal de Jerson. Tono neutro-cercano, respuestas concisas, sin filler. Español LATAM, tuteo. Cero emojis en respuestas formales.</p>
      </div>
      <div className="row gap2 wrap" style={{ margin: '12px 0 4px' }}>
        {['Más formal', 'Más casual', 'Más conciso'].map(s => <button key={s} className="chip" style={{ cursor: 'pointer', height: 32 }}>{s}</button>)}
      </div>

      <div className="t-xs tter fw6 cap" style={cfgLbl}>Voz</div>
      <div className="card">
        {['Elisa María', 'Mateo', 'Valentina'].map(v => (
          <div key={v} className="lrow" onClick={() => setVoice(v)}>
            <div className="lrow-ic"><Icon name="volume-2" size={18} /></div>
            <span className="grow t-base fw5">{v}</span>
            <button className="icon-btn" style={{ width: 36, height: 36 }}><Icon name="play" size={16} /></button>
            {voice === v && <Icon name="check" size={18} color="var(--accent)" />}
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
    </ConfigShell>
  );
}

// ---- Skills ----
function ConfigSkills({ nav }: { nav: Nav }) {
  return (
    <ConfigShell nav={nav} title="Skills y MCPs">
      <div className="t-xs tter fw6 cap" style={cfgLbl}>Instaladas</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {NX.skills.filter((s: Any) => s.installed).map((s: Any) => <SkillCard key={s.id} s={s} nav={nav} />)}
      </div>
      <div className="t-xs tter fw6 cap" style={cfgLbl}>Disponibles</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {NX.skills.filter((s: Any) => !s.installed).map((s: Any) => <SkillCard key={s.id} s={s} nav={nav} />)}
      </div>
    </ConfigShell>
  );
}
function SkillCard({ s, nav }: Any) {
  return (
    <div className="card card-pad col gap2" style={{ cursor: 'pointer' }} onClick={() => nav.toast(s.installed ? `${s.name} ya instalada` : `Instalando ${s.name}…`, s.installed ? 'check-circle' : 'download', s.installed ? 'success' : 'accent')}>
      <div className="row between">
        <div className="lrow-ic" style={{ width: 36, height: 36 }}><Icon name={s.icon} size={18} /></div>
        {s.pro && <Chip tone="accent" style={{ height: 20 }}>Pro</Chip>}
        {s.installed && !s.pro && <Icon name="check-circle" size={18} color="var(--success)" />}
      </div>
      <span className="t-sm fw6">{s.name}</span>
      <p className="t-xs tsec" style={{ margin: 0, lineHeight: 1.45 }}>{s.desc}</p>
      <span className="t-xs tter mono">{s.mcp}</span>
    </div>
  );
}

// ---- Conexiones ----
function ConfigConexiones({ nav }: { nav: Nav }) {
  return (
    <ConfigShell nav={nav} title="Conexiones">
      <p className="t-sm tsec" style={{ margin: '0 4px 14px', textWrap: 'pretty' }}>Tus tokens se cifran con AES-256 y se guardan en tu propio VPS. Nunca salen de tu entorno.</p>
      <div className="card">
        {NX.connections.map((c: Any) => (
          <div key={c.id} className="lrow" style={{ cursor: 'default' }}>
            <div className="lrow-ic"><Icon name={c.icon} size={19} /></div>
            <div className="grow col" style={{ gap: 2 }}>
              <span className="t-base fw5">{c.name}</span>
              <span className="t-xs" style={{ color: `var(--${c.tone === 'tertiary' ? 'text-tertiary' : c.tone})` }}>{c.status} · {c.detail}</span>
            </div>
            {c.status === 'Desconectado' ? (
              <Btn size="sm" variant="secondary">Conectar</Btn>
            ) : c.tone === 'warning' ? (
              <Btn size="sm" variant="secondary">Reautorizar</Btn>
            ) : (
              <Icon name="check-circle" size={20} color="var(--success)" />
            )}
          </div>
        ))}
      </div>
      <div className="card card-pad col gap3" style={{ marginTop: 16 }}>
        <div className="row gap2 t-sm fw6"><Icon name="send" size={16} color="var(--accent)" /> Bot de Telegram</div>
        <p className="t-sm tsec" style={{ margin: 0 }}>Escribe <span className="mono tacc">/start</span> a <span className="fw6">@NexusJ4Bot</span> y pega este código:</p>
        <div className="row center" style={{ gap: 8 }}>
          {'X7K9Q2'.split('').map((ch, i) => (
            <span key={i} className="mono t-2xl fw7 card center" style={{ width: 42, height: 52, color: 'var(--accent)' }}>{ch}</span>
          ))}
        </div>
        <span className="t-xs tter center" style={{ textAlign: 'center' }}>Expira en 9:42</span>
      </div>
    </ConfigShell>
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

// ---- Uso detalle ----
function UsoScreen({ nav }: { nav: Nav }) {
  return (
    <ConfigShell nav={nav} title="Uso del mes">
      <div className="card card-pad col gap5" style={{ marginBottom: 16 }}>
        {NX.usage.map((u: Any) => <QuotaRow key={u.label} {...u} />)}
      </div>
      <div className="card card-pad col gap2" style={{ borderColor: 'var(--warning)' }}>
        <div className="row gap2 t-sm fw6" style={{ color: 'var(--warning)' }}><Icon name="alert-triangle" size={16} /> Cerca del límite</div>
        <p className="t-sm tsec" style={{ margin: 0 }}>Llevas 4.1k de 5k mensajes este mes. Te quedan ~3 días al ritmo actual.</p>
        <Btn size="md" variant="primary" icon="crown" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => nav.push('upgrade')}>Ampliar cupo</Btn>
      </div>
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
