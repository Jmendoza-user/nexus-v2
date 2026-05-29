// ============================================================
// NEXUS — App shell · router · tab bar
// Port de app/app.jsx → módulo ES.
// Sin marco de celular ni panel de tweaks: la interfaz real
// llena el viewport (full-bleed en móvil, columna en escritorio).
// ============================================================
import { useState, useRef, useMemo, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from './lib/icons';
import { Toast } from './ui';
import { AuraVisualizer } from './components/AuraVisualizer';
import { useTweaks } from './components/TweaksPanel';
import type { Nav } from './screens/types';

import { HomeScreen } from './screens/Home';
import { FinanzasScreen, DraftDetail } from './screens/Finanzas';
import { ProyectosScreen, ProjectDetail, AgentesScreen, AgentDetail } from './screens/Proyectos';
import { VaultScreen, NoteScreen } from './screens/Vault';
import {
  CuentaScreen, ConfigPrincipal, ConfigSkills, ConfigConexiones,
  ConfigSeguridad, ConfigPreferencias, UsoScreen,
} from './screens/Cuenta';
import { UpgradeScreen, NotifsScreen, Drawer } from './screens/Misc';
import { ChatScreen } from './screens/Chat';
import { LoginScreen, Onboarding } from './screens/Onboarding';

type Any = any;

// keep AuraVisualizer referenced so unused-import linters stay quiet about the
// re-export used by some screens via this module's graph
void AuraVisualizer;

const TWEAK_DEFAULTS = {
  accent: '#7C5CFF',
  theme: 'dark',
  fontScale: 1,
  displayHeads: true,
};

const TABS = [
  { id: 'home', icon: 'mic', label: 'Hablar' },
  { id: 'proyectos', icon: 'folder-kanban', label: 'Proyectos' },
  { id: 'finanzas', icon: 'wallet', label: 'Finanzas' },
  { id: 'vault', icon: 'book-open', label: 'Vault' },
  { id: 'cuenta', icon: 'user', label: 'Cuenta' },
];

function TabBar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
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
function renderPushed(route: Any, _data: Any, nav: Nav, theme: string, setTheme: (v: string) => void) {
  switch (route.route) {
    case 'draft': return <DraftDetail nav={nav} data={route.data} />;
    case 'project': return <ProjectDetail nav={nav} data={route.data} />;
    case 'note': return <NoteScreen nav={nav} data={route.data} />;
    case 'agent': return <AgentDetail nav={nav} data={route.data} />;
    case 'agentes': return <AgentesScreen nav={nav} />;
    case 'notifs': return <NotifsScreen nav={nav} />;
    case 'chat': return <ChatScreen nav={nav} />;
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
  const [mode, setMode] = useState('login'); // login | onboarding | app
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState<Any[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [toasts, setToasts] = useState<Any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // theme controlled by tweak; preferencias screen also writes it
  const setTheme = (v: string) => setTweak('theme', v);
  const effLight = t.theme === 'light' || (t.theme === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const nav: Nav = useMemo(() => ({
    go: (toTab, pushRoute) => { setStack([]); setTab(toTab); if (pushRoute) setStack([{ route: pushRoute }]); },
    push: (route, data) => setStack(s => [...s, { route, data }]),
    back: () => setStack(s => s.slice(0, -1)),
    openDrawer: () => setDrawer(true),
    closeDrawer: () => setDrawer(false),
    toast: (msg, icon, tone) => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, icon, tone }]); },
  }), []);

  // Feedback al volver del OAuth de Google (?google=connected|denied|error).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('google');
    if (!p) return;
    const map: Record<string, [string, string, string]> = {
      connected: ['Google conectado', 'check-circle', 'success'],
      denied: ['Cancelaste la conexión con Google', 'x-circle', 'warning'],
      error: ['No se pudo conectar Google', 'alert-triangle', 'danger'],
      not_configured: ['Google aún no está configurado', 'alert-triangle', 'warning'],
    };
    const m = map[p];
    if (m) nav.toast(m[0], m[1], m[2]);
    window.history.replaceState({}, '', window.location.pathname);
  }, [nav]);

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

  const appStyle: CSSProperties = {
    ['--accent' as Any]: t.accent,
    ['--fs-scale' as Any]: t.fontScale,
    ['--font-display' as Any]: t.displayHeads ? "'Space Grotesk', 'Inter', sans-serif" : "'Inter', sans-serif",
  };

  return (
    <div className={`nx-viewport${effLight ? ' theme-light' : ''}`}>
      <div className={`nx-app nx-app-frame${effLight ? ' theme-light' : ''}`} style={appStyle}>
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
      </div>
    </div>
  );
}

export { App };
