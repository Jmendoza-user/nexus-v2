/**
 * NEXUS V2 — Pantalla 01: Home Conversacional
 * Ruta: /m/
 *
 * Estado: usuario con sesión activa, 3 borradores pendientes, 2 tareas vencen hoy.
 * Aura en estado idle (violeta pulsante).
 */

import { Bell, Settings, Mic, ChevronRight, Wallet, FolderKanban } from "lucide-react";

// ---------------------------------------------------------------------------
// Tipos y datos mock
// ---------------------------------------------------------------------------

type AuraState = "idle" | "listening" | "thinking" | "speaking";

const AURA_COLORS: Record<AuraState, string> = {
  idle:      "#7C5CFF",
  listening: "#34D399",
  thinking:  "#FBBF24",
  speaking:  "#3B82F6",
};

const mockTranscript = [
  { role: "assistant", text: "Buenas tardes, Jerson. Tienes 3 borradores por aprobar y 2 tareas que vencen hoy. ¿Empezamos por las finanzas?" },
];

const mockQuickItems = [
  { icon: Wallet,       label: "3 borradores", sub: "por aprobar",   color: "text-warning",  bg: "bg-warning-soft" },
  { icon: FolderKanban, label: "2 tareas",      sub: "vencen hoy",   color: "text-danger",   bg: "bg-danger-soft" },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function HomeConversacional() {
  const auraState: AuraState = "idle";
  const auraColor = AURA_COLORS[auraState];
  const hasNotifications = true;

  return (
    <div
      className="relative flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7] select-none overflow-hidden"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4">
        {/* Avatar usuario */}
        <button
          className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
          aria-label="Abrir perfil de usuario"
        >
          <div
            className="w-9 h-9 rounded-full bg-[#1A1A22] border border-[#2A2A36] flex items-center justify-center text-sm font-semibold text-[#F4F4F7]"
            aria-hidden="true"
          >
            J
          </div>
          <span className="text-sm font-medium text-[#A8A8B8]">Jerson</span>
        </button>

        {/* Bell con badge */}
        <button
          className="relative w-11 h-11 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
          aria-label={hasNotifications ? "Ver 5 notificaciones nuevas" : "Sin notificaciones"}
        >
          <Bell size={22} strokeWidth={1.75} className="text-[#A8A8B8]" />
          {hasNotifications && (
            <span
              className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EF4444]"
              aria-hidden="true"
            />
          )}
        </button>
      </header>

      {/* ── Saludo contextual ───────────────────────────────────── */}
      <div className="px-6 pb-2 z-10">
        <p className="text-[#A8A8B8] text-sm leading-relaxed">
          Martes 28 de mayo · 15:42
        </p>
      </div>

      {/* ── Cuerpo central ──────────────────────────────────────── */}
      <main className="flex flex-col items-center flex-1 px-6 z-10">

        {/* Quick items */}
        <div className="flex gap-3 w-full mb-8 mt-2">
          {mockQuickItems.map((item, i) => (
            <button
              key={i}
              className="flex-1 flex items-center gap-3 bg-[#101015] border border-[#1F1F29] rounded-[14px] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
              aria-label={`${item.label} ${item.sub}`}
            >
              <div className={`w-8 h-8 rounded-[10px] ${item.bg} flex items-center justify-center flex-shrink-0`}>
                <item.icon size={16} strokeWidth={1.75} className={item.color} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-[#F4F4F7] text-sm font-semibold leading-none truncate">{item.label}</p>
                <p className="text-[#6A6A7C] text-xs mt-0.5">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Aura visualizer placeholder */}
        <div className="relative flex items-center justify-center mb-8" role="img" aria-label={`Asistente en estado ${auraState}`}>
          {/* Anillo exterior pulsante */}
          <div
            className="absolute w-[260px] h-[260px] rounded-full opacity-10"
            style={{
              background: `radial-gradient(circle, ${auraColor}40 0%, transparent 70%)`,
              animation: "pulse-ring 2.4s ease-in-out infinite",
            }}
          />
          {/* Anillo medio */}
          <div
            className="absolute w-[220px] h-[220px] rounded-full opacity-20"
            style={{
              background: `radial-gradient(circle, ${auraColor}60 0%, transparent 65%)`,
              animation: "pulse-ring 2.4s ease-in-out infinite 0.3s",
            }}
          />
          {/* Core del Aura */}
          <div
            className="relative w-[180px] h-[180px] rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 40% 35%, ${auraColor}30 0%, ${auraColor}08 60%, transparent 100%)`,
              border: `1.5px solid ${auraColor}40`,
              boxShadow: `0 0 40px ${auraColor}20, inset 0 0 20px ${auraColor}10`,
            }}
          >
            {/* Partículas simuladas en ASCII — el canvas real implementa esto */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-[#6A6A7C] font-mono uppercase tracking-widest">
                {auraState}
              </span>
            </div>
          </div>
        </div>

        {/* Transcript flotante */}
        <div className="w-full max-w-sm mb-8" aria-live="polite" aria-label="Transcripción">
          {mockTranscript.map((turn, i) => (
            <p
              key={i}
              className="text-center text-[#A8A8B8] text-sm leading-relaxed px-2"
              style={{ animation: "fade-in 0.28s ease forwards" }}
            >
              {turn.text}
            </p>
          ))}
        </div>

        {/* Config rápido */}
        <button
          className="flex items-center gap-2 text-[#6A6A7C] text-xs rounded-full px-4 py-2 border border-[#1F1F29] hover:border-[#2A2A36] hover:text-[#A8A8B8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Configurar asistente"
        >
          <Settings size={14} strokeWidth={1.75} />
          Elisa María · Equilibrado
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </main>

      {/* ── FAB Mic ─────────────────────────────────────────────── */}
      {/* Flota sobre el tab-bar */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-1/2 -translate-x-1/2 z-20">
        <button
          className="w-20 h-20 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#07070A]"
          style={{
            background: `linear-gradient(135deg, ${auraColor} 0%, #5B3ECC 100%)`,
            boxShadow: `0 8px 32px ${auraColor}50`,
          }}
          aria-label="Hablar con el asistente. Mantén presionado para escribir"
        >
          <Mic size={28} strokeWidth={1.75} className="text-white" />
        </button>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <TabBarMock activeTab="home" />

      {/* Keyframes inyectados inline para el mockup standalone */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.97); opacity: 0.8; }
          60%  { transform: scale(1.08); opacity: 0; }
          100% { transform: scale(0.97); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Bar compartida (mockup standalone)
// ---------------------------------------------------------------------------

import { Mic as MicIcon, FolderKanban as FolderIcon, Wallet as WalletIcon, BookOpen, User } from "lucide-react";

const TAB_ITEMS = [
  { id: "home",      icon: MicIcon,     label: "Hablar",    href: "/m/" },
  { id: "proyectos", icon: FolderIcon,  label: "Proyectos", href: "/m/proyectos" },
  { id: "finanzas",  icon: WalletIcon,  label: "Finanzas",  href: "/m/finanzas" },
  { id: "vault",     icon: BookOpen,    label: "Vault",     href: "/m/vault" },
  { id: "cuenta",    icon: User,        label: "Cuenta",    href: "/m/cuenta" },
];

function TabBarMock({ activeTab }: { activeTab: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 bg-[#07070A]/90 border-t border-[#1F1F29]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around px-2 h-16">
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <a
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center px-3 rounded-[10px] transition-colors
                ${isActive ? "text-[#7C5CFF]" : "text-[#6A6A7C] hover:text-[#A8A8B8]"}`}
              aria-current={isActive ? "page" : undefined}
              role="tab"
              aria-selected={isActive}
            >
              <tab.icon
                size={22}
                strokeWidth={isActive ? 2 : 1.75}
                aria-hidden="true"
              />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
