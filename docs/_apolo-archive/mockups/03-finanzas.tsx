/**
 * NEXUS V2 — Pantalla 03: Finanzas
 * Ruta: /m/finanzas
 *
 * Tab activo: Inbox (3 borradores pendientes).
 * Muestra swipe cards con gestos simulados via clases de estado.
 */

import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Receipt,
  ShoppingCart, Music, Zap, ChevronRight,
  ThumbsUp, ThumbsDown, TrendingUp, Filter,
  Mic, FolderKanban, BookOpen, User,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

interface DraftTransaction {
  id: string;
  merchant: string;
  category: string;
  categoryIcon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  amount: number;               // positivo = ingreso, negativo = egreso
  date: string;
  time: string;
  confidence: number;           // 0-100
  channel: "gmail" | "ocr";
  recurring: boolean;
}

const DRAFTS: DraftTransaction[] = [
  {
    id: "txn_2026_0528_001",
    merchant: "Netflix",
    category: "Suscripciones",
    categoryIcon: Music,
    amount: -47900,
    date: "28 may",
    time: "08:14",
    confidence: 97,
    channel: "gmail",
    recurring: true,
  },
  {
    id: "txn_2026_0527_002",
    merchant: "Mercado Libre",
    category: "Compras",
    categoryIcon: ShoppingCart,
    amount: -185000,
    date: "27 may",
    time: "21:53",
    confidence: 89,
    channel: "gmail",
    recurring: false,
  },
  {
    id: "txn_2026_0527_003",
    merchant: "J4 Smart Solutions — cobro cliente",
    category: "Ingresos",
    categoryIcon: ArrowDownCircle,
    amount: 2400000,
    date: "27 may",
    time: "16:30",
    confidence: 94,
    channel: "gmail",
    recurring: false,
  },
];

const BALANCE_MONTH = 3_845_200;
const BALANCE_PREV_DIFF = 12.4; // porcentaje vs mes anterior

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type TabId = "resumen" | "inbox" | "historial";

export default function Finanzas() {
  const activeTab: TabId = "inbox";

  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Header con balance ─────────────────────────────────── */}
      <header className="px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[#F4F4F7] text-2xl font-semibold tracking-tight">Finanzas</h1>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#1F1F29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
            aria-label="Filtros"
          >
            <Filter size={16} strokeWidth={1.75} className="text-[#A8A8B8]" />
          </button>
        </div>

        {/* Balance */}
        <div className="mb-1">
          <p className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium mb-1">Balance mayo 2026</p>
          <p
            className="text-[2.25rem] font-bold leading-none tracking-tight"
            style={{
              fontFamily: "'Space Grotesk', var(--font-sans)",
              color: BALANCE_MONTH >= 0 ? "#22C55E" : "#EF4444",
            }}
            aria-label={`Balance del mes: ${formatCOP(BALANCE_MONTH)}`}
          >
            {formatCOP(BALANCE_MONTH)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} strokeWidth={1.75} className="text-[#22C55E]" aria-hidden="true" />
          <p className="text-[#22C55E] text-sm font-medium">
            +{BALANCE_PREV_DIFF}% vs abril
          </p>
        </div>
      </header>

      {/* ── Tabs segmentados ─────────────────────────────────────── */}
      <div className="px-5 mb-0" role="tablist" aria-label="Secciones de finanzas">
        <div className="flex bg-[#101015] rounded-[10px] p-1 border border-[#1F1F29]">
          {(["resumen", "inbox", "historial"] as TabId[]).map((tab) => {
            const labels: Record<TabId, string> = { resumen: "Resumen", inbox: "Inbox", historial: "Historial" };
            const isSelected = tab === activeTab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isSelected}
                className={`relative flex-1 py-2 text-xs font-medium rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]
                  ${isSelected ? "bg-[#7C5CFF] text-white" : "text-[#6A6A7C] hover:text-[#A8A8B8]"}`}
              >
                {labels[tab]}
                {tab === "inbox" && DRAFTS.length > 0 && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold
                      ${isSelected ? "bg-white/20 text-white" : "bg-[#F59E0B] text-[#07070A]"}`}
                    aria-label={`${DRAFTS.length} borradores pendientes`}
                  >
                    {DRAFTS.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Inbox de borradores ─────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]"
        role="tabpanel"
        aria-label="Borradores de transacciones pendientes"
      >
        {/* Instrucción swipe */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[#6A6A7C] text-xs">
            Desliza para aprobar o rechazar
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#22C55E]" aria-hidden="true" />
              <span className="text-[#6A6A7C] text-xs">Aprobar</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#EF4444]" aria-hidden="true" />
              <span className="text-[#6A6A7C] text-xs">Rechazar</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3" role="list" aria-label="Borradores de transacciones">
          {DRAFTS.map((draft) => (
            <TransactionDraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      </main>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <TabBarMock activeTab="finanzas" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction Draft Card (con indicadores de swipe simulados)
// ---------------------------------------------------------------------------

function TransactionDraftCard({ draft }: { draft: DraftTransaction }) {
  const isIncome = draft.amount > 0;
  const amountColor = isIncome ? "#22C55E" : "#EF4444";
  const confidenceColor =
    draft.confidence >= 90 ? "#22C55E" : draft.confidence >= 70 ? "#F59E0B" : "#EF4444";

  return (
    <div
      role="listitem"
      className="relative overflow-hidden bg-[#101015] border border-[#1F1F29] rounded-[14px]"
    >
      {/* Fondo de acción izquierda (rechazar) */}
      <div
        className="absolute inset-y-0 left-0 flex items-center px-5 bg-[#EF44441A] rounded-[14px]"
        aria-hidden="true"
      >
        <ThumbsDown size={20} strokeWidth={1.75} className="text-[#EF4444]" />
      </div>

      {/* Fondo de acción derecha (aprobar) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center px-5 bg-[#22C55E1A] rounded-[14px]"
        aria-hidden="true"
      >
        <ThumbsUp size={20} strokeWidth={1.75} className="text-[#22C55E]" />
      </div>

      {/* Card principal (draggable en implementación real) */}
      <a
        href={`/m/finanzas/borrador/${draft.id}`}
        className="relative flex items-center gap-3 p-4 bg-[#101015] rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
        aria-label={`Borrador: ${draft.merchant}, ${formatCOP(draft.amount)}, ${draft.date} ${draft.time}. Confianza IA: ${draft.confidence}%`}
      >
        {/* Icono categoría */}
        <div
          className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isIncome ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}
        >
          {isIncome
            ? <ArrowDownCircle size={20} strokeWidth={1.75} className="text-[#22C55E]" aria-hidden="true" />
            : <draft.categoryIcon size={20} strokeWidth={1.75} className="text-[#EF4444]" aria-hidden="true" />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[#F4F4F7] text-sm font-semibold leading-tight truncate">
              {draft.merchant}
            </p>
            <p
              className="text-sm font-bold flex-shrink-0 leading-tight"
              style={{ color: amountColor }}
            >
              {isIncome ? "+" : ""}{formatCOP(draft.amount)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#6A6A7C] text-xs">{draft.category}</span>
            <span className="text-[#2A2A36] text-xs">·</span>
            <span className="text-[#6A6A7C] text-xs">{draft.date} {draft.time}</span>
            {draft.recurring && (
              <>
                <span className="text-[#2A2A36] text-xs">·</span>
                <span className="text-[#F59E0B] text-xs">Recurrente</span>
              </>
            )}
          </div>

          {/* Chip confianza IA */}
          <div className="flex items-center gap-1.5 mt-2">
            <Zap size={11} strokeWidth={1.75} style={{ color: confidenceColor }} aria-hidden="true" />
            <span className="text-[10px] font-medium" style={{ color: confidenceColor }}>
              {draft.confidence}% confianza IA
            </span>
          </div>
        </div>

        <ChevronRight size={16} strokeWidth={1.75} className="text-[#2A2A36] flex-shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatCOP(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(abs);
  return amount < 0 ? `-${formatted}` : formatted;
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
