/**
 * NEXUS V2 — Pantalla 05: Cuenta
 * Ruta: /m/cuenta
 *
 * Usuario plan Pro, quota 78% mensajes, 45% voz, 30% vault.
 */

import {
  User, Sparkles, Bot, Plug, Shield, CreditCard,
  Settings, LogOut, ChevronRight, Bell, Globe,
  Mic, FolderKanban, Wallet, BookOpen,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

const USER = {
  name: "Jerson Mendoza",
  email: "jersonmendoza@j4smart.com",
  plan: "Pro",
  avatarInitial: "J",
};

interface QuotaItem {
  label: string;
  used: number;
  total: number;
  unit: string;
}

const QUOTAS: QuotaItem[] = [
  { label: "Mensajes IA",    used: 3900,  total: 5000,  unit: "msgs" },
  { label: "Voz",            used: 2250,  total: 5000,  unit: "s" },
  { label: "Vault",          used: 153,   total: 500,   unit: "MB" },
];

interface ConfigSection {
  id: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  subtitle?: string;
  href: string;
  badge?: string;
  badgeVariant?: "warning" | "danger" | "info";
}

const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: "principal",
    icon: Settings,
    label: "Asistente principal",
    subtitle: "Elisa María · Tono equilibrado",
    href: "/m/config/principal",
  },
  {
    id: "agentes",
    icon: Bot,
    label: "Mis agentes",
    subtitle: "3 activos · 12 skills instaladas",
    href: "/m/config/agentes",
    badge: "1 actualización",
    badgeVariant: "info",
  },
  {
    id: "conexiones",
    icon: Plug,
    label: "Conexiones",
    subtitle: "Gmail, Google Calendar, Telegram",
    href: "/m/config/conexiones",
    badge: "1 expira",
    badgeVariant: "warning",
  },
  {
    id: "seguridad",
    icon: Shield,
    label: "Seguridad y privacidad",
    subtitle: "TokenGuard activo · 127 redactions",
    href: "/m/config/seguridad",
  },
  {
    id: "plan",
    icon: CreditCard,
    label: "Plan y facturación",
    subtitle: "Pro · Próximo cobro 1 jun",
    href: "/m/upgrade",
  },
  {
    id: "preferencias",
    icon: Globe,
    label: "Preferencias",
    subtitle: "Español · Dark mode · Zona CO",
    href: "/m/config/preferencias",
  },
  {
    id: "notificaciones",
    icon: Bell,
    label: "Notificaciones",
    subtitle: "Borradores, runs, alertas quota",
    href: "/m/config/notificaciones",
  },
];

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function Cuenta() {
  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="px-5 pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-6">
        <h1 className="sr-only">Mi cuenta</h1>

        {/* Avatar + info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#5B3ECC] flex items-center justify-center text-white text-2xl font-bold"
              aria-hidden="true"
            >
              {USER.avatarInitial}
            </div>
            {/* Plan badge */}
            <div
              className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-[#7C5CFF] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              aria-label="Plan Pro activo"
            >
              <Sparkles size={9} strokeWidth={2} aria-hidden="true" />
              PRO
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[#F4F4F7] text-lg font-semibold leading-tight truncate">{USER.name}</p>
            <p className="text-[#6A6A7C] text-sm mt-0.5 truncate">{USER.email}</p>
          </div>

          <button
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#1F1F29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
            aria-label="Editar perfil"
          >
            <User size={16} strokeWidth={1.75} className="text-[#A8A8B8]" />
          </button>
        </div>

        {/* Quotas */}
        <div
          className="bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4"
          aria-label="Uso del mes de mayo"
        >
          <p className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium mb-4">
            Uso — mayo 2026
          </p>
          <div className="flex flex-col gap-4">
            {QUOTAS.map((q) => (
              <QuotaItem key={q.label} quota={q} />
            ))}
          </div>
        </div>
      </header>

      {/* ── Secciones de config ──────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]"
        aria-label="Opciones de configuración"
      >
        <div
          className="bg-[#101015] border border-[#1F1F29] rounded-[14px] overflow-hidden mb-4"
          role="list"
        >
          {CONFIG_SECTIONS.map((section, index) => (
            <div key={section.id} role="listitem">
              <a
                href={section.href}
                className="flex items-center gap-3 px-4 py-4 hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-inset"
                aria-label={`${section.label}${section.subtitle ? `: ${section.subtitle}` : ""}${section.badge ? `. ${section.badge}` : ""}`}
              >
                <div className="w-8 h-8 rounded-[10px] bg-[#1A1A22] flex items-center justify-center flex-shrink-0">
                  <section.icon size={16} strokeWidth={1.75} className="text-[#A8A8B8]" aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[#F4F4F7] text-sm font-medium leading-tight">{section.label}</p>
                  {section.subtitle && (
                    <p className="text-[#6A6A7C] text-xs mt-0.5 truncate">{section.subtitle}</p>
                  )}
                </div>

                {section.badge && (
                  <BadgeVariant label={section.badge} variant={section.badgeVariant ?? "info"} />
                )}

                <ChevronRight size={16} strokeWidth={1.75} className="text-[#6A6A7C] flex-shrink-0" aria-hidden="true" />
              </a>

              {index < CONFIG_SECTIONS.length - 1 && (
                <div className="ml-[calc(1rem+2rem+0.75rem)] h-px bg-[#1F1F29]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Cerrar sesión */}
        <button
          className="w-full flex items-center justify-center gap-2 bg-[#101015] border border-[#1F1F29] rounded-[14px] py-4 text-[#EF4444] text-sm font-medium hover:bg-[#EF44441A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]"
          aria-label="Cerrar sesión de la cuenta"
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          Cerrar sesión
        </button>

        {/* Versión */}
        <p className="text-center text-[#2A2A36] text-xs mt-6">NEXUS V2.0 · build 2026.05.28</p>
      </main>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <TabBarMock activeTab="cuenta" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quota item
// ---------------------------------------------------------------------------

function QuotaItem({ quota }: { quota: QuotaItem }) {
  const pct = Math.round((quota.used / quota.total) * 100);
  const barColor = pct >= 100 ? "#EF4444" : pct >= 80 ? "#F59E0B" : "#7C5CFF";

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[#A8A8B8] text-xs">{quota.label}</span>
        <span className="text-[#6A6A7C] text-xs font-mono">
          {formatNumber(quota.used)} / {formatNumber(quota.total)} {quota.unit}
        </span>
      </div>
      <div className="h-1.5 bg-[#1A1A22] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
          role="progressbar"
          aria-valuenow={quota.used}
          aria-valuemin={0}
          aria-valuemax={quota.total}
          aria-label={`${quota.label}: ${pct}% usado`}
        />
      </div>
      {pct >= 80 && (
        <p className="text-xs mt-1" style={{ color: barColor }}>
          {pct >= 100
            ? "Límite alcanzado. Mejora tu plan para continuar."
            : `Llevas ${pct}% — quedan ~${Math.floor(((quota.total - quota.used) / quota.used) * 28)} días al ritmo actual.`}
        </p>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ---------------------------------------------------------------------------
// Badge variant
// ---------------------------------------------------------------------------

function BadgeVariant({ label, variant }: { label: string; variant: "warning" | "danger" | "info" }) {
  const styles: Record<typeof variant, string> = {
    warning: "bg-[#F59E0B1A] text-[#F59E0B]",
    danger:  "bg-[#EF44441A] text-[#EF4444]",
    info:    "bg-[#60A5FA1A] text-[#60A5FA]",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[6px] flex-shrink-0 ${styles[variant]}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab Bar
// ---------------------------------------------------------------------------

const TAB_ITEMS = [
  { id: "home",      icon: Mic,          label: "Hablar",    href: "/m/" },
  { id: "proyectos", icon: FolderKanban, label: "Proyectos", href: "/m/proyectos" },
  { id: "finanzas",  icon: Wallet,       label: "Finanzas",  href: "/m/finanzas" },
  { id: "vault",     icon: BookOpen,     label: "Vault",     href: "/m/vault" },
  { id: "cuenta",    icon: User,         label: "Cuenta",    href: "/m/cuenta" },
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
              <tab.icon size={22} strokeWidth={isActive ? 2 : 1.75} aria-hidden="true" />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
