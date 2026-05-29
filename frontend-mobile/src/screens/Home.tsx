// ============================================================
// NEXUS — Home conversacional (/m/)
// Cableado a backend real (chat + voz). El diseño es CANON: NO se altera
// estructura/CSS, solo la lógica (fetch, estados del Aura, grabación).
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, Chip, IconBtn } from '../ui';
import { Icon } from '../lib/icons';
import { NX } from '../lib/data';
import { AuraVisualizer } from '../components/AuraVisualizer';
import { api, QuotaError } from '../lib/api';
import { addTurn, apiHistory } from '../lib/conversation';
import type { Nav } from './types';

// WAV silencioso mínimo para "desbloquear" el elemento <audio> dentro de un
// gesto del usuario (móvil bloquea play() programático fuera de gesto).
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function HomeScreen({ nav, accent }: { nav: Nav; accent: string }) {
  const [state, setState] = useState('idle'); // idle | listening | thinking | speaking
  const [greeting, setGreeting] = useState<string>(NX.home.greeting);
  const [plan, setPlan] = useState<string>(NX.user.plan);
  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState('');

  const mediaRec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const audioPrimed = useRef(false);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const STATE_LABEL: Record<string, string> = { idle: 'Toca para hablar', listening: 'Escuchando…', thinking: 'Pensando…', speaking: 'Respondiendo' };
  const STATE_COLOR: Record<string, string> = { idle: 'var(--text-tertiary)', listening: 'var(--state-listening)', thinking: 'var(--state-thinking)', speaking: 'var(--state-speaking)' };

  // Saludo + plan reales desde /api/auth/me.
  useEffect(() => {
    let alive = true;
    api.me().then((me) => {
      if (!alive) return;
      const first = (me.user.displayName || '').split(' ')[0] || me.user.displayName;
      const h = new Date().getHours();
      const part = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
      setGreeting(`${part}, ${first}.`);
      setPlan(me.tier ? me.tier.charAt(0).toUpperCase() + me.tier.slice(1) : NX.user.plan);
    }).catch(() => { /* mantiene el placeholder del diseño */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { stopRecording(); stopAudio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Elemento <audio> único y persistente (no recrear: una vez desbloqueado por
  // un gesto, sigue habilitado para play() programático).
  function ensureAudio(): HTMLAudioElement {
    if (!audioEl.current) {
      const el = new Audio();
      el.preload = 'auto';
      audioEl.current = el;
    }
    return audioEl.current;
  }

  // Desbloqueo de audio: se llama DENTRO del gesto (tap). Reproduce un silencio
  // muteado; tras eso el navegador permite play() programático más tarde.
  function primeAudio() {
    if (audioPrimed.current) return;
    try {
      const el = ensureAudio();
      el.muted = true;
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          try { el.pause(); el.currentTime = 0; } catch { /* noop */ }
          el.muted = false;
          audioPrimed.current = true;
        }).catch(() => { el.muted = false; });
      } else {
        el.muted = false;
        audioPrimed.current = true;
      }
    } catch { /* noop */ }
  }

  function stopAudio() {
    const el = audioEl.current;
    if (el) { try { el.pause(); } catch { /* noop */ } }
  }
  function stopRecording() {
    const rec = mediaRec.current;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* noop */ } }
    rec?.stream.getTracks().forEach((t) => t.stop());
    mediaRec.current = null;
  }

  function handleQuota(err: unknown): boolean {
    if (err instanceof QuotaError) {
      nav.toast('Llegaste al límite de tu plan', 'alert-triangle', 'warning');
      setState('idle');
      // CTA upgrade (usa la ruta pushed existente).
      setTimeout(() => nav.push('upgrade'), 400);
      return true;
    }
    return false;
  }

  // ── Reproducción de la respuesta con voz (Elisa) ────────────────────────────
  // El elemento ya quedó desbloqueado por el gesto del tap (primeAudio).
  async function speak(text: string) {
    setState('speaking');
    try {
      const blob = await api.synthesize(text);
      const url = URL.createObjectURL(blob);
      const el = ensureAudio();
      el.muted = false;
      el.src = url;
      el.onended = () => { setState('idle'); URL.revokeObjectURL(url); };
      el.onerror = () => { setState('idle'); URL.revokeObjectURL(url); };
      await el.play();
    } catch (e) {
      console.warn('[voice] playback falló:', (e as Error)?.message);
      nav.toast('No pude reproducir la voz', 'volume-2', 'warning');
      setState('idle');
    }
  }

  // ── Pregunta unificada (voz / texto / sugerencia) ───────────────────────────
  // El Home NO muestra texto: el turno se guarda en el store (visible en Chat)
  // y la respuesta SE HABLA. Así el texto nunca se adelanta a la voz.
  const ask = useCallback(async (userText: string, speakReply = true) => {
    const text = userText.trim();
    if (!text) return;
    stopAudio();
    const prior = apiHistory(12);
    addTurn('user', text);
    setState('thinking');
    try {
      const res = await api.chat(text, { history: prior });
      addTurn('assistant', res.reply);
      if (speakReply) await speak(res.reply);
      else setState('idle');
    } catch (err) {
      if (handleQuota(err)) return;
      nav.toast('No pude responder ahora mismo', 'alert-triangle', 'danger');
      setState('idle');
    }
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flujo de voz: grabar → transcribir → chat → sintetizar → reproducir ─────
  async function startVoice() {
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => { void onVoiceCaptured(); };
      mediaRec.current = rec;
      rec.start();
      setState('listening');
    } catch {
      nav.toast('No pude acceder al micrófono', 'mic-off', 'danger');
      setState('idle');
    }
  }

  async function onVoiceCaptured() {
    const blob = new Blob(chunks.current, { type: 'audio/webm' });
    mediaRec.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRec.current = null;
    if (blob.size === 0) { setState('idle'); return; }
    setState('thinking');
    try {
      const tr = await api.transcribe(blob, 'es');
      if (!tr.text) { setState('idle'); return; }
      await ask(tr.text, true); // guarda turnos en el store y habla la respuesta
    } catch (err) {
      if (handleQuota(err)) return;
      nav.toast('No pude procesar tu voz', 'alert-triangle', 'danger');
      setState('idle');
    }
  }

  // ── Interacción del FAB mic ─────────────────────────────────────────────────
  function micPointerDown() {
    primeAudio(); // desbloquea el audio dentro del gesto (clave en móvil)
    didLongPress.current = false;
    longPress.current = setTimeout(() => {
      didLongPress.current = true;
      setTextMode(true);
      setState('idle');
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 450);
  }
  function micPointerUp() {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
    if (didLongPress.current) return; // fue long-press → modo texto, no togglear voz

    if (state === 'idle') {
      void startVoice();
    } else if (state === 'listening') {
      stopRecording(); // dispara onstop → transcribe
    } else {
      // thinking/speaking → cancelar
      stopAudio();
      setState('idle');
    }
  }

  function submitDraft() {
    const v = draft.trim();
    if (!v) return;
    setDraft('');
    setTextMode(false);
    void ask(v);
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      {/* top bar */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav.openDrawer()} style={{ padding: 0 }}>
          <Avatar name={NX.user.name} size={36} />
        </button>
        <Chip tone="accent" icon="sparkles">{plan}</Chip>
        <div className="row gap2">
          <IconBtn name="message-circle" onClick={() => nav.push('chat')} />
          <IconBtn name="bell" badge onClick={() => nav.push('notifs')} />
        </div>
      </div>

      {/* center */}
      <div className="grow col center" style={{ padding: '0 24px', gap: 6, textAlign: 'center' }}>
        <div className="anim-up" style={{ marginBottom: 4 }}>
          <h2 className="t-xl fw7" style={{ margin: 0, letterSpacing: '-0.01em' }}>{greeting}</h2>
          <p className="t-sm tsec" style={{ margin: '6px 0 0', maxWidth: 280, textWrap: 'pretty' }}>{NX.home.summary}</p>
        </div>

        <div style={{ position: 'relative', margin: '12px 0 4px' }}>
          <AuraVisualizer state={state} size={236} accent={accent} />
        </div>

        <div className="row gap2 t-sm fw6" style={{ color: STATE_COLOR[state], minHeight: 22 }}>
          {state !== 'idle' && <span style={{ width: 7, height: 7, borderRadius: 99, background: STATE_COLOR[state], boxShadow: `0 0 10px ${STATE_COLOR[state]}` }} />}
          {STATE_LABEL[state]}
        </div>
        {/* Sin texto en el Home (experiencia tipo Alexa): la respuesta se habla.
            El historial de entrada/salida se ve en el Chat (botón arriba). */}
      </div>

      {/* suggestions */}
      {state === 'idle' && !textMode && (
        <div className="row gap2 wrap center anim-up" style={{ padding: '0 20px 14px' }}>
          {NX.home.suggestions.map((s: string) => (
            <button key={s} className="chip" style={{ cursor: 'pointer', height: 34 }} onClick={() => void ask(s)}>{s}</button>
          ))}
        </div>
      )}

      {/* text composer (long-press del mic) */}
      {textMode && (
        <div className="row gap2 anim-up" style={{ padding: '0 20px 12px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            className="field"
            placeholder="Escribe tu mensaje…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitDraft(); if (e.key === 'Escape') { setTextMode(false); setDraft(''); } }}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-md" onClick={submitDraft} aria-label="Enviar">
            <Icon name="send" size={18} />
          </button>
        </div>
      )}

      {/* mic FAB */}
      <div className="col center" style={{ paddingBottom: 18 }}>
        <button
          onPointerDown={micPointerDown}
          onPointerUp={micPointerUp}
          onPointerLeave={() => { if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; } }}
          aria-label="Hablar"
          style={{
            width: 80, height: 80, borderRadius: 28, border: 'none', cursor: 'pointer',
            background: state === 'idle' ? 'var(--accent)' : STATE_COLOR[state].replace('var(--', 'var(--'),
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 12px 32px ${state === 'idle' ? 'rgba(124,92,255,0.4)' : 'rgba(0,0,0,0.4)'}`,
            transition: 'transform .15s var(--ease), background .25s',
            transform: state === 'listening' ? 'scale(1.06)' : 'scale(1)',
          }}>
          <Icon name={state === 'idle' ? 'mic' : 'x'} size={32} sw={2} />
        </button>
        <span className="t-xs tter" style={{ marginTop: 8 }}>Mantén pulsado para escribir</span>
      </div>
    </div>
  );
}

export { HomeScreen };
