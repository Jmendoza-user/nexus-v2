// ============================================================
// NEXUS — Pantalla Chat (historial de la conversación de voz/texto).
// El Home no muestra texto (experiencia tipo Alexa); aquí se lee la
// entrada y salida. Diseño CANON: TopBar + burbujas con tokens.
// ============================================================
import { useEffect } from 'react';
import { IconBtn, TopBar } from '../ui';
import { Icon } from '../lib/icons';
import { useConversation, clearTurns, setTurns } from '../lib/conversation';
import { api } from '../lib/api';
import type { Nav } from './types';

function ChatScreen({ nav }: { nav: Nav }) {
  const turns = useConversation();

  // Hidrata el hilo desde el servidor (continuidad entre sesiones/dispositivos).
  useEffect(() => {
    api.chatHistory()
      .then((r) => setTurns(r.messages.map((m) => ({ role: m.role, content: m.content, ts: m.createdAt ? Date.parse(m.createdAt) : Date.now() }))))
      .catch(() => { /* mantiene lo que haya en memoria */ });
  }, []);

  async function clearAll() {
    try { await api.clearChatHistory(); } catch { /* noop */ }
    clearTurns();
    nav.toast('Conversación borrada', 'check', 'success');
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      <TopBar
        left={<IconBtn name="arrow-left" onClick={() => nav.back()} />}
        title="Conversación"
        right={
          turns.length > 0
            ? <IconBtn name="trash" onClick={() => void clearAll()} />
            : <span style={{ width: 44 }} />
        }
      />
      <div
        className="grow anim-screen"
        style={{ overflowY: 'auto', padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {turns.length === 0 ? (
          <div className="col center gap3" style={{ margin: 'auto', padding: '48px 16px', textAlign: 'center' }}>
            <div className="lrow-ic" style={{ width: 56, height: 56 }}><Icon name="message-circle" size={26} /></div>
            <span className="t-base fw6">Aún no hay conversación</span>
            <p className="t-sm tsec" style={{ margin: 0, maxWidth: 260 }}>
              Vuelve al inicio y toca el micrófono para hablar con tu asistente.
            </p>
          </div>
        ) : (
          turns.map((t, i) => {
            const mine = t.role === 'user';
            return (
              <div key={`${t.ts}-${i}`} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <div
                  className="t-xs tter fw6"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, textAlign: mine ? 'right' : 'left' }}
                >
                  {mine ? 'Tú' : 'Nexus'}
                </div>
                <div
                  style={{
                    padding: '10px 13px',
                    borderRadius: 'var(--r-lg)',
                    background: mine ? 'var(--accent)' : 'var(--bg-surface)',
                    color: mine ? '#fff' : 'var(--text-primary)',
                    border: mine ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  <p className="t-sm" style={{ margin: 0, whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{t.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export { ChatScreen };
