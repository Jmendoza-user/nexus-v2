// ============================================================
// NEXUS — Onboarding (/m/onboarding/*) + Login
// ============================================================
import { useState } from 'react';
import { Btn, Chip, IconBtn, Toggle } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import { AuraVisualizer } from '../components/AuraVisualizer';
import { api, type ApiError } from '../lib/api';

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

function Onboarding({ onDone, accent }: { onDone: () => void; accent: string }) {
  const [i, setI] = useState(0);
  const [plan, setPlan] = useState('pro');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Jerson Mendoza');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const step = ONB[i].key;

  async function finish() {
    // Registra al cerrar el onboarding. Si ya existe sesión/datos, onDone igual.
    setError(null);
    if (email.trim() && password) {
      setBusy(true);
      try {
        await api.register(email.trim(), password, name.trim() || email.split('@')[0]!);
      } catch (err) {
        const e = err as ApiError;
        // 409 = ya existe; lo tratamos como "ya tienes cuenta", seguimos.
        if (e.status !== 409) {
          setError(e.message || 'No se pudo crear la cuenta.');
          setBusy(false);
          return;
        }
      }
      setBusy(false);
    }
    onDone();
  }

  const next = () => {
    if (i < ONB.length - 1) {
      // Validación mínima en el paso de cuenta (sin alterar el diseño).
      if (step === 'cuenta' && (!email.trim() || password.length < 8)) {
        setError('Correo válido y contraseña de al menos 8 caracteres.');
        return;
      }
      setError(null);
      setI(i + 1);
    } else {
      void finish();
    }
  };
  const back = () => i > 0 && setI(i - 1);

  return (
    <div className="col" style={{ height: '100%' }}>
      {step !== 'bienvenida' && step !== 'listo' && (
        <div className="row between" style={{ padding: '14px 16px 6px' }}>
          <IconBtn name="arrow-left" onClick={back} />
          <Dots n={ONB.length - 2} i={i - 1} />
          <button className="btn btn-ghost btn-sm" onClick={next}>Saltar</button>
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
            <div><label className="field-label">Nombre</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="field-label">Idioma</label><input className="field" defaultValue="Español (Colombia)" /></div>
            <div><label className="field-label">Zona horaria</label><input className="field" defaultValue="América/Bogotá (GMT-5)" /></div>
          </OnbBody>
        )}
        {step === 'permisos' && (
          <OnbBody title="Permisos" sub="Para que NEXUS funcione de verdad.">
            <PermRow icon="mic" title="Micrófono" sub="Para hablar con tu agente" on />
            <PermRow icon="bell" title="Notificaciones" sub="Borradores, rutinas, alertas" on />
            <PermRow icon="download" title="Instalar como app" sub="Acceso desde tu pantalla de inicio" />
          </OnbBody>
        )}
        {step === 'agentes' && (
          <OnbBody title="Tu roster base" sub="Tres agentes listos desde el primer día.">
            <div className="col gap3">
              {NX.agents.map((a: Any) => (
                <div key={a.id} className="card card-pad row gap3" style={{ alignItems: 'center' }}>
                  <div className="lrow-ic" style={{ background: a.color + '22', color: a.color, width: 44, height: 44, borderRadius: 13 }}><Icon name={a.icon} size={22} /></div>
                  <div className="grow col" style={{ gap: 2 }}>
                    <span className="t-base fw6">{a.name}</span>
                    <span className="t-xs tsec">{a.desc}</span>
                  </div>
                  <Icon name="check-circle" size={20} color="var(--success)" />
                </div>
              ))}
            </div>
          </OnbBody>
        )}
        {step === 'conexiones' && (
          <OnbBody title="Conecta tus apps" sub="Opcional, pero hace magia. Tus tokens viven en tu VPS.">
            <div className="col gap3">
              {[{ n: 'Gmail', i: 'mail', d: 'Detectar tus movimientos', rec: true }, { n: 'Google Calendar', i: 'calendar', d: 'Tu agenda' }, { n: 'Telegram', i: 'send', d: 'Habla desde el chat' }].map(c => (
                <div key={c.n} className="card card-pad row gap3" style={{ alignItems: 'center' }}>
                  <div className="lrow-ic" style={{ width: 42, height: 42 }}><Icon name={c.i} size={20} /></div>
                  <div className="grow col" style={{ gap: 2 }}>
                    <span className="t-base fw6 row gap2">{c.n}{c.rec && <Chip tone="accent" style={{ height: 18 }}>Recomendado</Chip>}</span>
                    <span className="t-xs tsec">{c.d}</span>
                  </div>
                  <Btn size="sm" variant="secondary">Conectar</Btn>
                </div>
              ))}
            </div>
          </OnbBody>
        )}
        {step === 'plan' && (
          <OnbBody title="Elige tu plan" sub="Puedes cambiarlo cuando quieras.">
            <div className="col gap3">
              {NX.plans.filter((p: Any) => p.id !== 'team').map((p: Any) => (
                <button key={p.id} className="card card-pad col gap2" onClick={() => setPlan(p.id)}
                  style={{ textAlign: 'left', cursor: 'pointer', borderColor: plan === p.id ? 'var(--accent)' : 'var(--border-subtle)', boxShadow: plan === p.id ? '0 0 0 3px var(--accent-soft-2)' : 'var(--shadow-card)' }}>
                  <div className="row between">
                    <span className="t-lg fw7">{p.name}</span>
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
        {step === 'listo' && error && <p className="t-sm" style={{ margin: '0 0 8px', color: 'var(--danger)', textAlign: 'center' }}>{error}</p>}
        <Btn variant="primary" size="lg" full onClick={next} disabled={busy}>
          {busy ? 'Creando tu cuenta…' : step === 'bienvenida' ? 'Empezar' : step === 'listo' ? 'Ir a NEXUS' : step === 'plan' ? `Continuar con ${plan === 'pro' ? 'Pro' : 'Free'}` : 'Continuar'}
        </Btn>
      </div>
    </div>
  );
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
function PermRow({ icon, title, sub, on }: Any) {
  const [v, setV] = useState(!!on);
  return (
    <div className="card card-pad row gap3" style={{ alignItems: 'center' }}>
      <div className="lrow-ic" style={{ width: 42, height: 42, color: v ? 'var(--accent)' : undefined }}><Icon name={icon} size={20} /></div>
      <div className="grow col" style={{ gap: 2 }}>
        <span className="t-base fw6">{title}</span>
        <span className="t-xs tsec">{sub}</span>
      </div>
      <Toggle on={v} onChange={setV} />
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
