// ============================================================
// NEXUS — App shell · router · tab bar · phone frame · tweaks
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#7C5CFF",
  "theme": "dark",
  "fontScale": 1,
  "displayHeads": true
}/*EDITMODE-END*/;

const TABS = [
  { id: 'home', icon: 'mic', label: 'Hablar' },
  { id: 'proyectos', icon: 'folder-kanban', label: 'Proyectos' },
  { id: 'finanzas', icon: 'wallet', label: 'Finanzas' },
  { id: 'vault', icon: 'book-open', label: 'Vault' },
  { id: 'cuenta', icon: 'user', label: 'Cuenta' },
];

function StatusBar({ light }) {
  const c = light ? '#0A0A12' : '#F4F4F7';
  return (
    <div className="row between" style={{ height: 50, padding: '0 28px', flexShrink: 0, position: 'relative', zIndex: 30 }}>
      <span className="fw6" style={{ fontSize: 15, color: c, letterSpacing: '0.02em' }}>9:41</span>
      <div className="row gap2" style={{ alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11" fill={c}><rect x="0" y="6.5" width="3" height="4.5" rx="0.6"/><rect x="4.5" y="4" width="3" height="7" rx="0.6"/><rect x="9" y="2" width="3" height="9" rx="0.6"/><rect x="13.5" y="0" width="3" height="11" rx="0.6"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill={c}><path d="M8 2.6c2 0 3.9.8 5.3 2.2l-1 1A6 6 0 0 0 8 4a6 6 0 0 0-4.3 1.8l-1-1A7.5 7.5 0 0 1 8 2.6Z"/><path d="M8 5.8c1.2 0 2.3.5 3.1 1.3l-1 1A2.9 2.9 0 0 0 8 7a2.9 2.9 0 0 0-2.1.9l-1-1A4.3 4.3 0 0 1 8 5.8Z"/><circle cx="8" cy="9.4" r="1.2"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="16" height="8" rx="1.6" fill={c}/><path d="M23 4v4c.8-.3 1.3-1 1.3-2S23.8 4.3 23 4Z" fill={c} fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

function TabBar({ active, onSelect }) {
  return (
    <div className="tabbar">
      {TABS.map(t => (
        <button key={t.id} className={`tabitem${active === t.id ? ' on' : ''}`} onClick={() => onSelect(t.id)}>
          <Icon name={t.icon} size={23} sw={active === t.id ? 2.1 : 1.8} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Route registry for pushed screens
function renderPushed(route, data, nav, theme, setTheme) {
  switch (route.route) {
    case 'draft': return <DraftDetail nav={nav} data={route.data} />;
    case 'project': return <ProjectDetail nav={nav} data={route.data} />;
    case 'note': return <NoteScreen nav={nav} data={route.data} />;
    case 'agent': return <AgentDetail nav={nav} data={route.data} />;
    case 'agentes': return <AgentesScreen nav={nav} />;
    case 'notifs': return <NotifsScreen nav={nav} />;
    case 'upgrade': return <UpgradeScreen nav={nav} />;
    case 'principal': return <ConfigPrincipal nav={nav} />;
    case 'skills': return <ConfigSkills nav={nav} />;
    case 'conexiones': return <ConfigConexiones nav={nav} />;
    case 'seguridad': return <ConfigSeguridad nav={nav} />;
    case 'preferencias': return <ConfigPreferencias nav={nav} theme={theme} setTheme={setTheme} />;
    case 'uso': return <UsoScreen nav={nav} />;
    default: return null;
  }
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [mode, setMode] = React.useState('login'); // login | onboarding | app
  const [tab, setTab] = React.useState('home');
  const [stack, setStack] = React.useState([]);
  const [drawer, setDrawer] = React.useState(false);
  const [toasts, setToasts] = React.useState([]);
  const scrollRef = React.useRef(null);

  // theme controlled by tweak; preferencias screen also writes it
  const setTheme = (v) => setTweak('theme', v);
  const effLight = t.theme === 'light' || (t.theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const nav = React.useMemo(() => ({
    go: (toTab, pushRoute) => { setStack([]); setTab(toTab); if (pushRoute) setStack([{ route: pushRoute }]); },
    push: (route, data) => setStack(s => [...s, { route, data }]),
    back: () => setStack(s => s.slice(0, -1)),
    openDrawer: () => setDrawer(true),
    closeDrawer: () => setDrawer(false),
    toast: (msg, icon, tone) => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, icon, tone }]); },
  }), []);

  function renderTab() {
    switch (tab) {
      case 'home': return <HomeScreen nav={nav} accent={t.accent} />;
      case 'proyectos': return <ProyectosScreen nav={nav} />;
      case 'finanzas': return <FinanzasScreen nav={nav} />;
      case 'vault': return <VaultScreen nav={nav} />;
      case 'cuenta': return <CuentaScreen nav={nav} />;
      default: return null;
    }
  }

  const top = stack[stack.length - 1];
  const showTabBar = mode === 'app' && !top;

  const appStyle = {
    '--accent': t.accent,
    '--fs-scale': t.fontScale,
    '--font-display': t.displayHeads ? "'Space Grotesk', 'Inter', sans-serif" : "'Inter', sans-serif",
  };

  return (
    <div className={`nx-app${effLight ? ' theme-light' : ''}`} style={{ ...appStyle, position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StatusBar light={effLight} />
      <div ref={scrollRef} className="grow" style={{ position: 'relative', overflow: 'hidden' }}>
        {mode === 'login' && <LoginScreen onLogin={() => setMode('app')} onOnboard={() => setMode('onboarding')} />}
        {mode === 'onboarding' && <Onboarding accent={t.accent} onDone={() => { setMode('app'); setTab('home'); }} />}
        {mode === 'app' && (
          <>
            <div style={{ position: 'absolute', inset: 0, paddingBottom: showTabBar ? 'var(--tabbar-h)' : 0 }} key={tab}>
              {renderTab()}
            </div>
            {top && (
              <div className="anim-screen" key={stack.length} style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', zIndex: 70 }}>
                {renderPushed(top, top.data, nav, t.theme, setTheme)}
              </div>
            )}
            <Drawer open={drawer} onClose={() => setDrawer(false)} nav={nav} />
          </>
        )}

        {/* toasts */}
        {toasts.map(ts => (
          <Toast key={ts.id} msg={ts.msg} icon={ts.icon} tone={ts.tone} onDone={() => setToasts(x => x.filter(z => z.id !== ts.id))} />
        ))}
      </div>

      {showTabBar && <TabBar active={tab} onSelect={(id) => { setStack([]); setTab(id); }} />}

      {/* home indicator */}
      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100, pointerEvents: 'none' }}>
        <div style={{ width: 134, height: 5, borderRadius: 99, background: effLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)' }} />
      </div>

      <TweaksPanel>
        <TweakSection label="Marca" />
        <TweakColor label="Acento" value={t.accent} options={['#7C5CFF', '#3B82F6', '#22C55E', '#F0508C', '#FB7185', '#14B8A6']} onChange={v => setTweak('accent', v)} />
        <TweakSection label="Tema" />
        <TweakRadio label="Apariencia" value={t.theme} options={['dark', 'light', 'auto']} onChange={v => setTweak('theme', v)} />
        <TweakSection label="Tipografía" />
        <TweakSlider label="Escala" value={t.fontScale} min={0.9} max={1.15} step={0.05} onChange={v => setTweak('fontScale', v)} />
        <TweakToggle label="Titulares display (Space Grotesk)" value={t.displayHeads} onChange={v => setTweak('displayHeads', v)} />
        <TweakSection label="Navegación" />
        <TweakButton label="Ver onboarding" onClick={() => { setStack([]); setMode('onboarding'); }} />
        <TweakButton label="Ir a login" onClick={() => { setStack([]); setMode('login'); }} />
      </TweaksPanel>
    </div>
  );
}

// ---- Phone frame + responsive scaling ----
function PhoneStage() {
  const W = 390, H = 844;
  const wrapRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    function fit() {
      const pad = 24;
      const aw = window.innerWidth - pad * 2;
      const ah = window.innerHeight - pad * 2;
      setScale(Math.min(aw / W, ah / H, 1.15));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div ref={wrapRef} style={{ width: W * scale, height: H * scale }}>
      <div style={{
        width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left',
        borderRadius: 54, position: 'relative', overflow: 'hidden',
        background: 'var(--bg-base)', boxShadow: '0 50px 100px rgba(0,0,0,0.5), 0 0 0 11px #16161c, 0 0 0 13px #2a2a32',
      }}>
        {/* dynamic island */}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 120, height: 35, borderRadius: 22, background: '#000', zIndex: 200 }} />
        <App />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PhoneStage />);
