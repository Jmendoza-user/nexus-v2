/**
 * NEXUS V2 — Pantalla 04: Vault
 * Ruta: /m/vault
 *
 * Estado: vault con notas recientes, búsqueda vacía, sin filtros activos.
 * Vista: mosaic 2 columnas (mobile).
 */

import {
  BookOpen, Plus, Search, Hash, Link2, Clock,
  Quote, Mic, FolderKanban, Wallet, User, Filter,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

interface VaultNote {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  backlinks: number;
  modifiedAt: string;
  folder: "Diarios" | "Conceptos" | "Proyectos" | "Preferencias";
  size: "normal" | "tall"; // para el masonry visual
}

const NOTES: VaultNote[] = [
  {
    id: "n1",
    title: "Decisiones Amparo RAG",
    excerpt: "Clasificador Sonnet + retrieval determinista. Retrieval híbrido RRF k=60 con tsvector y pgvector HNSW...",
    tags: ["amparo", "rag", "decisión"],
    backlinks: 4,
    modifiedAt: "Hoy 14:22",
    folder: "Proyectos",
    size: "tall",
  },
  {
    id: "n2",
    title: "28 mayo 2026",
    excerpt: "Quiniela Mundial: portal pagos QR Binance. NEXUS V2 plan de diseño iniciado con APOLO...",
    tags: ["daily"],
    backlinks: 2,
    modifiedAt: "Hoy 08:00",
    folder: "Diarios",
    size: "normal",
  },
  {
    id: "n3",
    title: "NEXUS V2 — Filosofía de producto",
    excerpt: "Conversational-first no chat-only. El usuario habla, el agente responde con voz + tarjeta visual...",
    tags: ["nexus", "producto", "diseño"],
    backlinks: 7,
    modifiedAt: "Ayer",
    folder: "Conceptos",
    size: "tall",
  },
  {
    id: "n4",
    title: "Preferencias de Jerson",
    excerpt: "Respuestas concisas. Calidad sobre velocidad. Sin emojis en UI cromática...",
    tags: ["preferencias", "perfil"],
    backlinks: 12,
    modifiedAt: "26 may",
    folder: "Preferencias",
    size: "normal",
  },
  {
    id: "n5",
    title: "HKA API — Hallazgos técnicos",
    excerpt: "HTTP 4xx body JSON {codigo, mensaje, validaciones[]}. Estructuras 3-niveles. numeroLinea STRING...",
    tags: ["ariadna", "hka", "api"],
    backlinks: 2,
    modifiedAt: "20 may",
    folder: "Proyectos",
    size: "normal",
  },
  {
    id: "n6",
    title: "Modelo de negocio J4",
    excerpt: "SaaS B2C primario (Amparo, Ariadna, NEXUS). B2B futuro con PyMEs Colombia. Pricing...",
    tags: ["j4", "negocio", "estrategia"],
    backlinks: 5,
    modifiedAt: "15 may",
    folder: "Conceptos",
    size: "normal",
  },
];

const FOLDER_COLORS: Record<VaultNote["folder"], string> = {
  Diarios:      "#7C5CFF",
  Conceptos:    "#3B82F6",
  Proyectos:    "#F59E0B",
  Preferencias: "#22C55E",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function Vault() {
  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[#F4F4F7] text-2xl font-semibold tracking-tight">Vault</h1>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#7C5CFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
            aria-label="Crear nueva nota"
          >
            <Plus size={18} strokeWidth={2} className="text-white" />
          </button>
        </div>

        {/* Search bar prominente */}
        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.75}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6A6A7C] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Busca notas o haz una pregunta..."
            className="w-full bg-[#101015] border border-[#1F1F29] rounded-[10px] pl-10 pr-4 py-3 text-sm text-[#F4F4F7] placeholder:text-[#6A6A7C] focus:outline-none focus:border-[#7C5CFF] focus:ring-2 focus:ring-[#7C5CFF]/20 transition-colors"
            aria-label="Buscar en el vault"
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
            aria-label="Filtros del vault"
          >
            <Filter size={14} strokeWidth={1.75} className="text-[#6A6A7C]" />
          </button>
        </div>
      </header>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div className="flex gap-4 px-5 pb-4">
        {[
          { label: "notas", value: "127" },
          { label: "backlinks", value: "284" },
          { label: "tags", value: "38" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-baseline gap-1">
            <span className="text-[#F4F4F7] text-sm font-semibold">{stat.value}</span>
            <span className="text-[#6A6A7C] text-xs">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ── RAG answer banner (aparece si la búsqueda es una pregunta) ── */}
      {/* En este estado la búsqueda está vacía, no se muestra */}

      {/* ── Mosaic de notas ─────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]"
        aria-label="Notas del vault"
      >
        {/* Sección: Recientes */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium">Recientes</h2>
          <button className="text-[#7C5CFF] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1">
            Ver todo
          </button>
        </div>

        {/* Masonry 2 columnas */}
        <div className="columns-2 gap-3 space-y-0" role="list">
          {NOTES.map((note) => (
            <div key={note.id} className="break-inside-avoid mb-3" role="listitem">
              <VaultNoteCard note={note} />
            </div>
          ))}
        </div>
      </main>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <TabBarMock activeTab="vault" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VaultNoteCard
// ---------------------------------------------------------------------------

function VaultNoteCard({ note }: { note: VaultNote }) {
  const folderColor = FOLDER_COLORS[note.folder];

  return (
    <a
      href={`/m/vault/${note.id}`}
      className="block bg-[#101015] border border-[#1F1F29] rounded-[14px] p-3.5 hover:border-[#2A2A36] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
      aria-label={`Nota: ${note.title}. ${note.backlinks} backlinks. Modificada ${note.modifiedAt}`}
    >
      {/* Folder indicator */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: folderColor }}
          aria-hidden="true"
        />
        <span className="text-[10px] font-medium" style={{ color: folderColor }}>
          {note.folder}
        </span>
      </div>

      {/* Título */}
      <h3 className="text-[#F4F4F7] text-sm font-semibold leading-snug mb-2 line-clamp-2">
        {note.title}
      </h3>

      {/* Excerpt */}
      <p className="text-[#6A6A7C] text-xs leading-relaxed mb-3 line-clamp-3">
        {note.excerpt}
      </p>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-0.5 bg-[#1A1A22] text-[#6A6A7C] text-[10px] rounded-[6px] px-1.5 py-0.5"
            >
              <Hash size={9} strokeWidth={1.75} aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {note.backlinks > 0 && (
          <div className="flex items-center gap-1">
            <Link2 size={11} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <span className="text-[10px] text-[#6A6A7C]">{note.backlinks}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Clock size={11} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
          <span className="text-[10px] text-[#6A6A7C]">{note.modifiedAt}</span>
        </div>
      </div>
    </a>
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
