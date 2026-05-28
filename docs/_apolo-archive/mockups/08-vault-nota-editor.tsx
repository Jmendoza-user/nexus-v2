/**
 * NEXUS V2 — Pantalla 08: Vault — Nota Editor
 * Ruta: /m/vault/:notePath
 *
 * Nota: "NEXUS V2 — Filosofía de producto"
 * Modo: visual (TipTap). Toggle a código disponible en top-bar.
 */

import {
  ArrowLeft, Code, Eye, MoreVertical, Hash,
  Link2, Quote, ChevronRight, BookOpen, Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

const NOTE = {
  id: "n3",
  title: "NEXUS V2 — Filosofía de producto",
  folder: "Conceptos",
  modifiedAt: "Ayer 22:14",
  wordCount: 487,
  tags: ["nexus", "producto", "diseño", "filosofía"],
  content: [
    {
      type: "h2",
      text: "Principios fundamentales",
    },
    {
      type: "paragraph",
      text: "NEXUS V2 nace de una premisa simple: la IA debería hablar primero, no esperar a que el usuario escriba. La voz es el canal más natural de comunicación humana, y la PWA debe reflejarlo.",
    },
    {
      type: "paragraph",
      text: "El concepto de Human-in-the-Loop no es una restricción técnica — es una ventaja de producto. Cuando el agente detecta una transacción y pide aprobación explícita, está comunicando confianza y control.",
    },
    {
      type: "h3",
      text: "El Aura como interfaz emocional",
    },
    {
      type: "paragraph",
      text: "El visualizador de audio no es decoración. Es el único elemento UI que comunica el estado interno del agente en tiempo real: idle (violeta), escuchando (verde), procesando (ámbar), respondiendo (azul).",
    },
    {
      type: "callout",
      text: "Decisión: mantener el Aura en centro absoluto del home, sin competencia visual. Todo lo demás es periférico.",
    },
  ],
};

const BACKLINKS = [
  { id: "n1", title: "Decisiones Amparo RAG",             mentions: 2 },
  { id: "n4", title: "Preferencias de Jerson",            mentions: 1 },
  { id: "n8", title: "Feedback UI Amparo — Apple",        mentions: 1 },
];

const RAG_RELATED = [
  { id: "n2", title: "28 mayo 2026",                      relevance: 0.87 },
  { id: "n6", title: "Modelo de negocio J4",              relevance: 0.74 },
];

type EditorMode = "visual" | "code";

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function VaultNotaEditor() {
  const editorMode: EditorMode = "visual";
  const showBacklinksSheet = false;

  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 border-b border-[#1F1F29]">
        <a
          href="/m/vault"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Volver al vault"
        >
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>

        {/* Folder indicator */}
        <div className="flex items-center gap-1.5 bg-[#3B82F61A] rounded-full px-3 py-1">
          <BookOpen size={12} strokeWidth={1.75} className="text-[#3B82F6]" aria-hidden="true" />
          <span className="text-[#3B82F6] text-xs font-medium">{NOTE.folder}</span>
        </div>

        <div className="flex-1" />

        {/* Mode toggle — visual / code */}
        <div
          className="flex bg-[#1A1A22] rounded-[8px] p-1"
          role="radiogroup"
          aria-label="Modo del editor"
        >
          <button
            role="radio"
            aria-checked={editorMode === "visual"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]
              ${editorMode === "visual" ? "bg-[#7C5CFF] text-white" : "text-[#6A6A7C] hover:text-[#A8A8B8]"}`}
          >
            <Eye size={12} strokeWidth={1.75} aria-hidden="true" />
            Visual
          </button>
          <button
            role="radio"
            aria-checked={editorMode === "code"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]
              ${editorMode === "code" ? "bg-[#7C5CFF] text-white" : "text-[#6A6A7C] hover:text-[#A8A8B8]"}`}
          >
            <Code size={12} strokeWidth={1.75} aria-hidden="true" />
            Código
          </button>
        </div>

        <button
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Más opciones de la nota"
        >
          <MoreVertical size={18} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </button>
      </header>

      {/* ── Editor ──────────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+40px)]"
        aria-label="Contenido de la nota"
      >
        {/* Título editable */}
        <div className="px-5 pt-5 pb-3">
          <h1
            className="text-[#F4F4F7] text-2xl font-bold leading-tight outline-none"
            contentEditable
            suppressContentEditableWarning
            aria-label="Título de la nota"
            role="textbox"
            aria-multiline="false"
          >
            {NOTE.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[#6A6A7C] text-xs">{NOTE.modifiedAt}</span>
            <span className="text-[#2A2A36] text-xs">·</span>
            <span className="text-[#6A6A7C] text-xs">{NOTE.wordCount} palabras</span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {NOTE.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-[#1A1A22] text-[#6A6A7C] text-xs rounded-[6px] px-2 py-1 cursor-pointer hover:text-[#A8A8B8] hover:bg-[#2A2A36] transition-colors"
              >
                <Hash size={10} strokeWidth={1.75} aria-hidden="true" />
                {tag}
              </span>
            ))}
            <button
              className="flex items-center gap-1 text-[#6A6A7C] text-xs px-2 py-1 rounded-[6px] hover:text-[#A8A8B8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
              aria-label="Agregar etiqueta"
            >
              <Hash size={10} strokeWidth={1.75} aria-hidden="true" />
              Agregar
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-[#1F1F29] mb-4" />

        {/* Contenido de la nota (modo visual) */}
        <div
          className="px-5"
          role="textbox"
          aria-multiline="true"
          aria-label="Contenido de la nota"
          contentEditable
          suppressContentEditableWarning
        >
          {NOTE.content.map((block, i) => {
            if (block.type === "h2") {
              return (
                <h2 key={i} className="text-[#F4F4F7] text-xl font-semibold mb-3 mt-6 first:mt-0 outline-none">
                  {block.text}
                </h2>
              );
            }
            if (block.type === "h3") {
              return (
                <h3 key={i} className="text-[#F4F4F7] text-lg font-semibold mb-2.5 mt-5 outline-none">
                  {block.text}
                </h3>
              );
            }
            if (block.type === "paragraph") {
              return (
                <p key={i} className="text-[#A8A8B8] text-base leading-[1.7] mb-4 outline-none">
                  {block.text}
                </p>
              );
            }
            if (block.type === "callout") {
              return (
                <div
                  key={i}
                  className="flex gap-3 bg-[#7C5CFF10] border border-[#7C5CFF30] rounded-[12px] px-4 py-3 mb-4"
                >
                  <Sparkles size={16} strokeWidth={1.75} className="text-[#7C5CFF] mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <p className="text-[#A8A8B8] text-sm leading-relaxed outline-none">
                    {block.text}
                  </p>
                </div>
              );
            }
            return null;
          })}

          {/* Cursor de escritura visual */}
          <div className="flex items-center gap-1 mt-2 mb-8">
            <div className="w-0.5 h-5 bg-[#7C5CFF] animate-pulse" aria-hidden="true" />
            <span className="text-[#2A2A36] text-sm italic">Escribe o habla para continuar...</span>
          </div>
        </div>

        {/* ── Backlinks y referencias ──────────────────────────── */}
        <div className="mx-5 mt-4 mb-2">
          <div className="h-px bg-[#1F1F29] mb-4" />

          {/* Backlinks */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={14} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
              <p className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium">
                {BACKLINKS.length} Backlinks
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {BACKLINKS.map((bl) => (
                <a
                  key={bl.id}
                  href={`/m/vault/${bl.id}`}
                  className="flex items-center justify-between bg-[#101015] border border-[#1F1F29] rounded-[10px] px-3 py-2.5 hover:border-[#2A2A36] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                  aria-label={`Backlink: ${bl.title}, ${bl.mentions} ${bl.mentions === 1 ? "mención" : "menciones"}`}
                >
                  <span className="text-[#A8A8B8] text-sm">{bl.title}</span>
                  <span className="text-[#6A6A7C] text-xs font-mono">×{bl.mentions}</span>
                </a>
              ))}
            </div>
          </div>

          {/* RAG relacionadas */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Quote size={14} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
              <p className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium">
                Relacionadas por IA
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {RAG_RELATED.map((rel) => (
                <a
                  key={rel.id}
                  href={`/m/vault/${rel.id}`}
                  className="flex items-center justify-between bg-[#101015] border border-[#1F1F29] rounded-[10px] px-3 py-2.5 hover:border-[#2A2A36] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                  aria-label={`Nota relacionada: ${rel.title}, relevancia ${Math.round(rel.relevance * 100)}%`}
                >
                  <span className="text-[#A8A8B8] text-sm">{rel.title}</span>
                  <span className="text-[#6A6A7C] text-xs font-mono">{Math.round(rel.relevance * 100)}%</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
