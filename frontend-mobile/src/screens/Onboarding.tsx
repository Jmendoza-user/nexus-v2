// ============================================================
// NEXUS — Onboarding (/m/onboarding/*) + Login
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Btn, Chip, IconBtn, Toggle } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import { AuraVisualizer } from '../components/AuraVisualizer';
import { api, type ApiError, type AgentItem, type TelegramPairResponse } from '../lib/api';

type Any = any;

function Dots({ n, i }: { n: number; i: number }) {
  return (
    <div className="row gap2 center">
      {Array.from({ length: n }).map((_, k) => (
        <span key={k} style={{ height: 6, borderRadius: 99, transition: 'all .3s var(--ease)', width: k === i ? 22 : 6, background: k === i ? 'var(--accent)' : 'var(--border-strong)' }} />
      ))}
    </div>
  );
}

function LoginScreen({ onLogin, onOnboard }: { onLogin: () => void; onOnboard: () => void }) {
  const [email, setEmail] = useState('jersonmendoza@eyesa.com.co');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setBusy(true);
    try {
      await api.login(email.trim(), password);
      onLogin();
    } catch (err) {
      const e = err as ApiError;
      setError(e.status === 401 ? 'Correo o contraseña incorrectos.' : (e.message || 'No se pudo iniciar sesión.'));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter') submit();
  }

  return (
    <div className="col" style={{ height: '100%', padding: '0 28px', justifyContent: 'center' }}>
      <div className="col gap6" style={{ marginBottom: 40 }}>
        <div className="col gap4" style={{ alignItems: 'center', textAlign: 'center' }}>
          <NexusMark size={64} />
          <div className="col gap2" style={{ alignItems: 'center' }}>
            <h1 className="t-3xl fw7 display" style={{ margin: 0 }}>NEXUS</h1>
            <p className="t-sm tsec" style={{ margin: 0 }}>Tu agente personal, en tu bolsillo.</p>
          </div>
        </div>
      </div>
      <div className="col gap3">
        <div><label className="field-label">Correo</label><input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown} /></div>
        <div><label className="field-label">Contraseña</label><input className="field" type="password" autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown} /></div>
        {error && <p className="t-sm" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}
        <Btn variant="primary" size="lg" full onClick={submit} disabled={busy} style={{ marginTop: 8 }}>{busy ? 'Entrando…' : 'Entrar'}</Btn>
        <Btn variant="secondary" size="lg" full><Icon name="globe" size={18} /> Continuar con Google</Btn>
      </div>
      <button className="btn btn-ghost btn-md" style={{ marginTop: 22, alignSelf: 'center' }} onClick={onOnboard}>
        Crear una cuenta nueva
      </button>
    </div>
  );
}

const ONB = [
  { key: 'bienvenida' }, { key: 'cuenta' }, { key: 'perfil' }, { key: 'permisos' },
  { key: 'agentes' }, { key: 'conexiones' }, { key: 'plan' }, { key: 'listo' },
];

// Mapeo nombre de agente base (backend) → icono/color de presentación.
const AGENT_PRESENTATION: Record<string, { icon: string; color: string }> = {
  'asistente-personal': { icon: 'sparkles', color: '#7C5CFF' },
  'curador-finanzas': { icon: 'wallet', color: '#22C55E' },
  'curador-vault': { icon: 'book-open', color: '#3B82F6' },
};

function Onboarding({ onDone, accent }: { onDone: () => void; accent: string }) {
  const [i, setI] = useState(0);
  const [plan, setPlan] = useState('free');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [locale, setLocale] = useState('Español (Colombia)');
  const [tz, setTz] = useState('América/Bogotá (GMT-5)');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Estado de backend conforme avanza el flujo.
  const [registered, setRegistered] = useState(false);
  const [agents, setAgents] = useState<AgentItem[] | null>(null);
  const [pairing, setPairing] = useState<TelegramPairResponse | null>(null);
  const [tgLinked, setTgLinked] = useState(false);
  const step = ONB[i]!.key;

  // Crea la cuenta al salir del paso "cuenta" (deja cookie de sesión para los
  // pasos siguientes que tocan backend autenticado).
  const ensureRegistered = useCallback(async (): Promise<boolean> => {
    if (registered) return true;
    try {
      await api.register(email.trim(), password, name.trim() || email.split('@')[0]!);
      setRegistered(true);
      return true;
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409) {
        // Ya existe: intenta iniciar sesión con esas credenciales para continuar.
        try {
          await api.login(email.trim(), password);
          setRegistered(true);
          return true;
        } catch {
          setError('Ese correo ya tiene cuenta. Revisa tu contraseña.');
          return false;
        }
      }
      setError(e.message || 'No se pudo crear la cuenta.');
      return false;
    }
  }, [registered, email, password, name]);

  // Carga el roster base real al entrar al paso "agentes".
  useEffect(() => {
    if (step === 'agentes' && registered && agents === null) {
      api.agents().then((r) => setAgents(r.agents)).catch(() => setAgents([]));
    }
  }, [step, registered, agents]);

  // Pide un código de vinculación Telegram al entrar a "conexiones".
  useEffect(() => {
    if (step === 'conexiones' && registered) {
      api.telegramPairingStatus().then((s) => setTgLinked(s.linked)).catch(() => {});
      if (!pairing) {
        api.telegramPair().then(setPairing).catch(() => {});
      }
    }
  }, [step, registered, pairing]);

  async function finish() {
    setError(null);
    setBusy(true);
    const ok = await ensureRegistered();
    setBusy(false);
    if (ok) onDone();
  }

  const next = async () => {
    if (i >= ONB.length - 1) { void finish(); return; }
    setError(null);

    if (step === 'cuenta') {
      if (!email.trim() || password.length < 8) {
        setError('Correo válido y contraseña de al menos 8 caracteres.');
        return;
      }
      setBusy(true);
      const ok = await ensureRegistered();
      setBusy(false);
      if (!ok) return;
    }

    if (step === 'perfil' && registered) {
      // Persiste el perfil; no bloquea el avance si falla la red.
      setBusy(true);
      try {
        await api.updateProfile({
          displayName: name.trim() || undefined,
          locale: localeToCode(locale),
          timezone: tzToIana(tz),
        });
      } catch { /* no bloquea el onboarding */ }
      setBusy(false);
    }

    setI(i + 1);
  };
  const back = () => i > 0 && setI(i - 1);

  return (
    <div className="col" style={{ height: '100%' }}>
      {step !== 'bienvenida' && step !== 'listo' && (
        <div className="row between" style={{ padding: '14px 16px 6px' }}>
          <IconBtn name="arrow-left" onClick={back} />
          <Dots n={ONB.length - 2} i={i - 1} />
          <button className="btn btn-ghost btn-sm" onClick={() => { void next(); }}>Saltar</button>
        </div>
      )}

      <div className="grow anim-screen" key={step} style={{ overflowY: 'auto', padding: '8px 28px 16px' }}>
        {step === 'bienvenida' && (
          <div className="col center" style={{ height: '100%', textAlign: 'center', gap: 20 }}>
            <AuraVisualizer state="speaking" size={200} accent={accent} />
            <h1 className="t-3xl fw7 display" style={{ margin: 0, textWrap: 'balance' }}>Hola, soy tu NEXUS</h1>
            <p className="t-base tsec" style={{ margin: 0, maxWidth: 300, textWrap: 'pretty' }}>Hablo, escucho y me anticipo. Gestiono tu agenda, tus finanzas y tu segundo cerebro. Empecemos.</p>
          </div>
        )}
        {step === 'cuenta' && (
          <OnbBody title="Crea tu cuenta" sub="Te toma menos de un minuto.">
            <div><label className="field-label">Correo</label><input className="field" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label className="field-label">Contraseña</label><input className="field" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p className="t-sm" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}
            <label className="row gap2 t-sm tsec" style={{ marginTop: 4 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid var(--accent)', background: 'var(--accent)', display: 'flex' }}><Icon name="check" size={14} sw={3} color="#fff" /></span>
              Acepto los términos y la política de privacidad
            </label>
          </OnbBody>
        )}
        {step === 'perfil' && (
          <OnbBody title="Cuéntame de ti" sub="Para personalizar tu asistente.">
            <div><label className="field-label">Nombre</label><input className="field" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="field-label">Idioma</label><input className="field" value={locale} onChange={(e) => setLocale(e.target.value)} /></div>
            <div><label className="field-label">Zona horaria</label><input className="field" value={tz} onChange={(e) => setTz(e.target.value)} /></div>
          </OnbBody>
        )}
        {step === 'permisos' && (
          <OnbBody title="Permisos" sub="Para que NEXUS funcione de verdad.">
            <PermRow icon="mic" title="Micrófono" sub="Para hablar con tu agente" on permission="mic" />
            <PermRow icon="bell" title="Notificaciones" sub="Borradores, rutinas, alertas" on permission="notifications" />
            <PermRow icon="download" title="Instalar como app" sub="Acceso desde tu pantalla de inicio" />
          </OnbBody>
        )}
        {step === 'agentes' && (
          <OnbBody title="Tu roster base" sub="Tres agentes listos desde el primer día.">
            <div className="col gap3">
              {(agents ?? []).map((a) => {
                const p = AGENT_PRESENTATION[a.name] ?? { icon: 'bot', color: '#7C5CFF' };
                return (
                  <div key={a.id} className="card card-pad row gap3" style={{ alignItems: 'center' }}>
                    <div className="lrow-ic" style={{ background: p.color + '22', color: p.color, width: 44, height: 44, borderRadius: 13 }}><Icon name={p.icon} size={22} /></div>
                    <div className="grow col" style={{ gap: 2 }}>
                      <span className="t-base fw6">{a.displayName}</span>
                      <span className="t-xs tsec">{agentSubtitle(a.name)}</span>
                    </div>
                    <Icon name="check-circle" size={20} color="var(--success)" />
                  </div>
                );
              })}
              {agents === null && <p className="t-sm tsec" style={{ margin: 0 }}>Preparando tus agentes…</p>}
            </div>
          </OnbBody>
        )}
        {step === 'conexiones' && (
          <OnbBody title="Conecta tus apps" sub="Opcional, pero hace magia. Tus tokens viven en tu VPS.">
            <div className="col gap3">
              {/* Gmail y Calendar: seam listo, OAuth real en hito posterior. */}
              {[{ n: 'Gmail', i: 'mail', d: 'Detectar tus movimientos', rec: true }, { n: 'Google Calendar', i: 'calendar', d: 'Tu agenda' }].map(c => (
                <div key={c.n} className="card card-pad row gap3" style={{ alignItems: 'center' }}>
                  <div className="lrow-ic" style={{ width: 42, height: 42 }}><Icon name={c.i} size={20} /></div>
                  <div className="grow col" style={{ gap: 2 }}>
                    <span className="t-base fw6 row gap2">{c.n}{c.rec && <Chip tone="accent" style={{ height: 18 }}>Recomendado</Chip>}</span>
                    <span className="t-xs tsec">{c.d}</span>
                  </div>
                  <Btn size="sm" variant="secondary" disabled>Próximamente</Btn>
                </div>
              ))}
              {/* Telegram: vinculación real por código. */}
              <div className="card card-pad col gap3">
                <div className="row gap3" style={{ alignItems: 'center' }}>
                  <div className="lrow-ic" style={{ width: 42, height: 42, color: 'var(--accent)' }}><Icon name="send" size={20} /></div>
                  <div className="grow col" style={{ gap: 2 }}>
                    <span className="t-base fw6">Telegram</span>
                    <span className="t-xs tsec">Habla con tu agente desde el chat</span>
                  </div>
                  {tgLinked && <Icon name="check-circle" size={20} color="var(--success)" />}
                </div>
                {!tgLinked && pairing && (
                  <>
                    <p className="t-sm tsec" style={{ margin: 0 }}>Abre <span className="fw6">@{pairing.botUsername}</span>, envía <span className="mono tacc">/start</span> y pega este código:</p>
                    <div className="row center" style={{ gap: 8 }}>
                      {pairing.code.split('').map((ch, k) => (
                        <span key={k} className="mono t-2xl fw7 card center" style={{ width: 42, height: 52, color: 'var(--accent)' }}>{ch}</span>
                      ))}
                    </div>
                    <span className="t-xs tter center" style={{ textAlign: 'center' }}>Caduca en {Math.round(pairing.ttlSeconds / 60)} min</span>
                  </>
                )}
                {!tgLinked && !pairing && <p className="t-sm tsec" style={{ margin: 0 }}>Generando tu código…</p>}
              </div>
            </div>
          </OnbBody>
        )}
        {step === 'plan' && (
          <OnbBody title="Elige tu plan" sub="Puedes cambiarlo cuando quieras.">
            <div className="col gap3">
              {NX.plans.map((p: Any) => (
                <button key={p.id} className="card card-pad col gap2" onClick={() => setPlan(p.id)}
                  style={{ textAlign: 'left', cursor: 'pointer', borderColor: plan === p.id ? 'var(--accent)' : 'var(--border-subtle)', boxShadow: plan === p.id ? '0 0 0 3px var(--accent-soft-2)' : 'var(--shadow-card)' }}>
                  <div className="row between">
                    <span className="t-lg fw7 row gap2">{p.name}{p.id !== 'free' && <Chip tone="accent" style={{ height: 18 }}>Próximamente</Chip>}</span>
                    <span className="t-lg fw7">{p.price}<span className="t-sm tsec fw5">{p.period}</span></span>
                  </div>
                  <span className="t-xs tsec">{p.tagline} · {p.model}</span>
                </button>
              ))}
            </div>
          </OnbBody>
        )}
        {step === 'listo' && (
          <div className="col center" style={{ height: '100%', textAlign: 'center', gap: 18 }}>
            <div style={{ position: 'relative' }}>
              <AuraVisualizer state="listening" size={180} accent={accent} />
            </div>
            <h1 className="t-3xl fw7 display" style={{ margin: 0 }}>¡Todo listo!</h1>
            <p className="t-base tsec" style={{ margin: 0, maxWidth: 280, textWrap: 'pretty' }}>Tu vault tiene plantillas, tus 3 agentes están activos. Pregúntame lo que quieras.</p>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 28px calc(16px + env(safe-area-inset-bottom))' }}>
        {(step === 'listo' || step === 'cuenta') && error && <p className="t-sm" style={{ margin: '0 0 8px', color: 'var(--danger)', textAlign: 'center' }}>{error}</p>}
        <Btn variant="primary" size="lg" full onClick={() => { void next(); }} disabled={busy}>
          {busy ? (step === 'cuenta' ? 'Creando tu cuenta…' : 'Un momento…') : step === 'bienvenida' ? 'Empezar' : step === 'listo' ? 'Ir a NEXUS' : step === 'plan' ? `Continuar con ${planLabel(plan)}` : 'Continuar'}
        </Btn>
      </div>
    </div>
  );
}

// Helpers de presentación / mapeo de formularios libres a códigos canónicos.
function planLabel(id: string): string {
  return id === 'pro' ? 'Pro' : id === 'team' ? 'Team' : 'Free';
}
function agentSubtitle(name: string): string {
  if (name === 'asistente-personal') return 'Tu agente central. Voz, agenda y orquestación.';
  if (name === 'curador-finanzas') return 'Detecta movimientos y arma borradores.';
  if (name === 'curador-vault') return 'Indexa y conecta tu segundo cerebro.';
  return 'Agente base.';
}
function localeToCode(s: string): string {
  const v = s.toLowerCase();
  if (v.includes('colombia') || v.includes('es-co')) return 'es-CO';
  if (v.includes('méxico') || v.includes('mexico') || v.includes('es-mx')) return 'es-MX';
  if (v.includes('españa') || v.includes('es-es')) return 'es-ES';
  return s.trim().length <= 6 ? s.trim() : 'es-CO';
}
function tzToIana(s: string): string {
  const v = s.toLowerCase();
  if (v.includes('bogot')) return 'America/Bogota';
  if (v.includes('mexico') || v.includes('méxico')) return 'America/Mexico_City';
  if (v.includes('madrid') || v.includes('españa')) return 'Europe/Madrid';
  // Si ya parece un IANA válido (contiene '/'), úsalo tal cual.
  return s.includes('/') && !s.includes(' ') ? s.trim() : 'America/Bogota';
}
function OnbBody({ title, sub, children }: Any) {
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="col gap2" style={{ marginTop: 8 }}>
        <h1 className="t-2xl fw7" style={{ margin: 0 }}>{title}</h1>
        <p className="t-sm tsec" style={{ margin: 0, textWrap: 'pretty' }}>{sub}</p>
      </div>
      <div className="col gap3">{children}</div>
    </div>
  );
}
function PermRow({ icon, title, sub, on, permission }: Any) {
  const [v, setV] = useState(!!on);
  // Solicita el permiso real del navegador al activar (cliente, sin backend).
  async function handle(next: boolean): Promise<void> {
    setV(next);
    if (!next) return;
    try {
      if (permission === 'notifications' && 'Notification' in window) {
        await Notification.requestPermission();
      } else if (permission === 'mic' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Liberamos de inmediato: solo queríamos el consentimiento.
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      // Permiso denegado por el usuario: refleja el estado real.
      setV(false);
    }
  }
  return (
    <div className="card card-pad row gap3" style={{ alignItems: 'center' }}>
      <div className="lrow-ic" style={{ width: 42, height: 42, color: v ? 'var(--accent)' : undefined }}><Icon name={icon} size={20} /></div>
      <div className="grow col" style={{ gap: 2 }}>
        <span className="t-base fw6">{title}</span>
        <span className="t-xs tsec">{sub}</span>
      </div>
      <Toggle on={v} onChange={(next: boolean) => { void handle(next); }} />
    </div>
  );
}

// Brand mark
function NexusMark({ size = 48 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: 'linear-gradient(140deg, var(--accent), #b69bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(124,92,255,0.4)' }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64" fill="none">
        <path d="M18 48 V16 L46 48 V16" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="18" cy="16" r="4.6" fill="#fff" />
        <circle cx="18" cy="48" r="4.6" fill="#fff" />
        <circle cx="46" cy="48" r="4.6" fill="#fff" />
        <circle cx="46" cy="16" r="4.6" fill="#fff" />
        <circle cx="32" cy="32" r="6" fill="#fff" />
        <circle cx="32" cy="32" r="2.4" fill="var(--accent)" />
      </svg>
    </div>
  );
}

export { LoginScreen, Onboarding, NexusMark, Dots };
