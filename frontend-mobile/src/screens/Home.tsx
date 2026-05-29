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
import { api, QuotaError, type ChatTurn } from '../lib/api';
import type { Nav } from './types';

function HomeScreen({ nav, accent }: { nav: Nav; accent: string }) {
  const [state, setState] = useState('idle'); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>(NX.home.greeting);
  const [plan, setPlan] = useState<string>(NX.user.plan);
  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState('');

  const history = useRef<ChatTurn[]>([]);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioEl = useRef<HTMLAudioElement | null>(null);
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

  function stopAudio() {
    if (audioEl.current) { try { audioEl.current.pause(); } catch { /* noop */ } audioEl.current = null; }
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

  // ── Envío de texto al asistente ────────────────────────────────────────────
  const sendText = useCallback(async (msg: string) => {
    const text = msg.trim();
    if (!text) return;
    stopAudio();
    setResponse(null);
    setTranscript(text);
    setState('thinking');
    try {
      const res = await api.chat(text, { history: history.current.slice(-12) });
      history.current.push({ role: 'user', content: text }, { role: 'assistant', content: res.reply });
      setResponse(res.reply);
      setState('idle');
    } catch (err) {
      if (handleQuota(err)) return;
      nav.toast('No pude responder ahora mismo', 'alert-triangle', 'danger');
      setState('idle');
    }
  }, [nav]);

  // ── Flujo de voz: grabar → transcribir → chat → sintetizar → reproducir ─────
  async function startVoice() {
    stopAudio();
    setResponse(null);
    setTranscript(null);
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
      setTranscript(tr.text);
      const res = await api.chat(tr.text, { history: history.current.slice(-12) });
      history.current.push({ role: 'user', content: tr.text }, { role: 'assistant', content: res.reply });
      setResponse(res.reply);
      // TTS y reproducción.
      setState('speaking');
      try {
        const audioBlob = await api.synthesize(res.reply);
        const url = URL.createObjectURL(audioBlob);
        const el = new Audio(url);
        audioEl.current = el;
        el.onended = () => { setState('idle'); URL.revokeObjectURL(url); };
        el.onerror = () => { setState('idle'); URL.revokeObjectURL(url); };
        await el.play();
      } catch {
        setState('idle'); // si falla TTS, igual mostramos el texto
      }
    } catch (err) {
      if (handleQuota(err)) return;
      nav.toast('No pude procesar tu voz', 'alert-triangle', 'danger');
      setState('idle');
    }
  }

  // ── Interacción del FAB mic ─────────────────────────────────────────────────
  function micPointerDown() {
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
    void sendText(v);
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      {/* top bar */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav.openDrawer()} style={{ padding: 0 }}>
          <Avatar name={NX.user.name} size={36} />
        </button>
        <Chip tone="accent" icon="sparkles">{plan}</Chip>
        <IconBtn name="bell" badge onClick={() => nav.push('notifs')} />
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

        {/* transcript */}
        <div style={{ minHeight: 84, width: '100%', maxWidth: 320 }}>
          {transcript && (
            <div className="anim-up" style={{ marginTop: 8 }}>
              <div className="t-xs tter fw6" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tú</div>
              <p className="t-base" style={{ margin: 0, color: 'var(--text-primary)' }}>“{transcript}”</p>
            </div>
          )}
          {response && (
            <div className="anim-up" style={{ marginTop: 14, padding: '12px 14px', background: 'var(--accent-soft)', borderRadius: 'var(--r-lg)', border: '1px solid var(--accent-soft-2)' }}>
              <p className="t-sm" style={{ margin: 0, textWrap: 'pretty' }}>{response}</p>
            </div>
          )}
        </div>
      </div>

      {/* suggestions */}
      {state === 'idle' && !response && !textMode && (
        <div className="row gap2 wrap center anim-up" style={{ padding: '0 20px 14px' }}>
          {NX.home.suggestions.map((s: string) => (
            <button key={s} className="chip" style={{ cursor: 'pointer', height: 34 }} onClick={() => void sendText(s)}>{s}</button>
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
