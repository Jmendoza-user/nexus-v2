// ============================================================
// NEXUS — Home conversacional (/m/)
// ============================================================
function HomeScreen({ nav, accent }) {
  const [state, setState] = React.useState('idle');
  const [transcript, setTranscript] = React.useState(null);
  const [response, setResponse] = React.useState(null);
  const timers = React.useRef([]);

  const STATE_LABEL = { idle: 'Toca para hablar', listening: 'Escuchando…', thinking: 'Pensando…', speaking: 'Respondiendo' };
  const STATE_COLOR = { idle: 'var(--text-tertiary)', listening: 'var(--state-listening)', thinking: 'var(--state-thinking)', speaking: 'var(--state-speaking)' };

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  React.useEffect(() => () => clearTimers(), []);

  function runDemo(q) {
    clearTimers();
    setResponse(null);
    setState('listening');
    setTranscript(q || 'Muéstrame mis borradores de hoy');
    timers.current.push(setTimeout(() => setState('thinking'), 1700));
    timers.current.push(setTimeout(() => {
      setState('speaking');
      setResponse('Tienes 3 borradores: Rappi $38.500, Davivienda $184.000 y una transferencia de $4.100.000. ¿Los reviso contigo?');
    }, 3100));
    timers.current.push(setTimeout(() => setState('idle'), 7600));
  }

  function tapMic() {
    if (state === 'idle') runDemo();
    else { clearTimers(); setState('idle'); setTranscript(null); setResponse(null); }
  }

  return (
    <div className="col" style={{ height: '100%' }}>
      {/* top bar */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav.openDrawer()} style={{ padding: 0 }}>
          <Avatar name={NX.user.name} size={36} />
        </button>
        <Chip tone="accent" icon="sparkles">{NX.user.plan}</Chip>
        <IconBtn name="bell" badge onClick={() => nav.push('notifs')} />
      </div>

      {/* center */}
      <div className="grow col center" style={{ padding: '0 24px', gap: 6, textAlign: 'center' }}>
        <div className="anim-up" style={{ marginBottom: 4 }}>
          <h2 className="t-xl fw7" style={{ margin: 0, letterSpacing: '-0.01em' }}>{NX.home.greeting}</h2>
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
              <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => nav.go('finanzas')}>
                <Icon name="wallet" size={15} /> Revisar borradores
              </button>
            </div>
          )}
        </div>
      </div>

      {/* suggestions */}
      {state === 'idle' && !response && (
        <div className="row gap2 wrap center anim-up" style={{ padding: '0 20px 14px' }}>
          {NX.home.suggestions.map(s => (
            <button key={s} className="chip" style={{ cursor: 'pointer', height: 34 }} onClick={() => runDemo(s)}>{s}</button>
          ))}
        </div>
      )}

      {/* mic FAB */}
      <div className="col center" style={{ paddingBottom: 18 }}>
        <button onClick={tapMic} aria-label="Hablar"
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

window.HomeScreen = HomeScreen;
