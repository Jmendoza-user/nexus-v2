/**
 * NEXUS V2 — Pantalla 09: Agente Detalle
 * Ruta: /m/agentes/:id
 *
 * Agente: APOLO (diseño y branding). Status: Idle.
 */

import {
  ArrowLeft, Bot, Zap, X, Play, Clock,
  Wrench, CheckCircle2, AlertCircle, PlugZap,
  Mic as MicIcon, ChevronRight, Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

type AgentStatus = "idle" | "running" | "paused" | "error";

const AGENT = {
  id: "apolo",
  name: "APOLO",
  description: "El Artista Luminoso. Especializado en identidad visual, branding, UX/UI y materiales de marketing para J4 Smart Solutions. Genera mockups, banners, prompts de imagen y documentación de diseño.",
  status: "idle" as AgentStatus,
  model: "claude-sonnet-4-6",
  lastRun: "Hoy 14:22",
  totalRuns: 47,
  avgDuration: "3m 12s",
  tokensUsed: 284350,
};

interface Skill {
  id: string;
  name: string;
  description: string;
  active: boolean;
  mcpRequired?: string;
  hasUpdate?: boolean;
}

const SKILLS: Skill[] = [
  { id: "s1", name: "ui-ux-pro-max",      description: "Diseño web e interfaces de usuario",         active: true },
  { id: "s2", name: "banner-design",       description: "Banners para redes sociales y marketing",    active: true },
  { id: "s3", name: "efecto-vidrio",        description: "Glassmorphism y efectos translúcidos",       active: true },
  { id: "s4", name: "image-gen-prompts",    description: "Prompts optimizados para Midjourney/DALL-E", active: true, hasUpdate: true },
  { id: "s5", name: "color-theory",         description: "Análisis y generación de paletas",           active: false },
  { id: "s6", name: "motion-spec",          description: "Especificaciones Framer Motion",             active: false },
];

interface RunRecord {
  id: string;
  trigger: string;
  status: "success" | "error" | "running";
  duration: string;
  tokens: number;
  timestamp: string;
}

const RUNS: RunRecord[] = [
  { id: "r1", trigger: "Plan de diseño NEXUS V2",           status: "success", duration: "18m 42s", tokens: 85420, timestamp: "Hoy 14:22" },
  { id: "r2", trigger: "Banner Instagram J4",               status: "success", duration: "2m 15s",  tokens: 12340, timestamp: "Ayer 16:08" },
  { id: "r3", trigger: "Mockups landing Amparo",            status: "error",   duration: "1m 03s",  tokens: 4200,  timestamp: "26 may" },
  { id: "r4", trigger: "Paleta colores Ágora CRM",          status: "success", duration: "4m 51s",  tokens: 18900, timestamp: "25 may" },
];

const STATUS_STYLES: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  idle:    { color: "#A8A8B8", bg: "#1A1A22",         label: "Inactivo" },
  running: { color: "#7C5CFF", bg: "rgba(124,92,255,0.15)", label: "Ejecutando" },
  paused:  { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Pausado" },
  error:   { color: "#EF4444", bg: "rgba(239,68,68,0.15)",  label: "Error" },
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function AgenteDetalle() {
  const statusStyle = STATUS_STYLES[AGENT.status];

  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a
          href="/m/cuenta"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Volver"
        >
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="flex-1 text-[#F4F4F7] text-base font-semibold">Detalle del agente</h1>
      </header>

      {/* ── Hero agente ──────────────────────────────────────────── */}
      <div className="px-5 pb-5 border-b border-[#1F1F29]">
        <div className="flex items-start gap-4">
          {/* Avatar agente */}
          <div
            className="w-16 h-16 rounded-[14px] flex items-center justify-center text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #7C5CFF 0%, #5B3ECC 100%)" }}
            aria-hidden="true"
          >
            <Bot size={28} strokeWidth={1.5} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[#F4F4F7] text-xl font-bold">{AGENT.name}</h2>
              <Sparkles size={14} strokeWidth={1.75} className="text-[#7C5CFF]" aria-hidden="true" />
            </div>

            {/* Status pill */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2"
              style={{ backgroundColor: statusStyle.bg }}
              role="status"
              aria-label={`Estado: ${statusStyle.label}`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: statusStyle.color,
                  animation: AGENT.status === "running" ? "pulse 1.5s ease-in-out infinite" : "none",
                }}
                aria-hidden="true"
              />
              <span className="text-xs font-semibold" style={{ color: statusStyle.color }}>
                {statusStyle.label}
              </span>
            </div>

            <p className="text-[#6A6A7C] text-xs">{AGENT.model}</p>
          </div>
        </div>

        <p className="text-[#A8A8B8] text-sm leading-relaxed mt-4">{AGENT.description}</p>

        {/* Stats */}
        <div className="flex gap-4 mt-4">
          {[
            { label: "Ejecuciones", value: AGENT.totalRuns },
            { label: "Duración avg", value: AGENT.avgDuration },
            { label: "Tokens", value: formatTokens(AGENT.tokensUsed) },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-[#F4F4F7] text-sm font-bold">{stat.value}</p>
              <p className="text-[#6A6A7C] text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* CTA hablar */}
        <button
          className="w-full mt-4 flex items-center justify-center gap-2 bg-[#7C5CFF] text-white rounded-[14px] py-3.5 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
          style={{ boxShadow: "0 8px 24px rgba(124,92,255,0.30)" }}
          aria-label="Hablar con este agente"
        >
          <MicIcon size={18} strokeWidth={1.75} />
          Hablar con APOLO
        </button>
      </div>

      {/* ── Scroll contenido ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">

        {/* Skills */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium">Skills habilitadas</p>
            <button
              className="text-[#7C5CFF] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1"
              aria-label="Ir al catálogo de skills"
            >
              Catálogo
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {SKILLS.filter(s => s.active).map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-2 bg-[#1A1A22] border border-[#2A2A36] rounded-[10px] px-3 py-2"
              >
                <Zap size={13} strokeWidth={1.75} className="text-[#7C5CFF]" aria-hidden="true" />
                <span className="text-[#F4F4F7] text-xs font-medium font-mono">{skill.name}</span>
                {skill.hasUpdate && (
                  <div
                    className="w-2 h-2 rounded-full bg-[#F59E0B]"
                    aria-label="Actualización disponible"
                  />
                )}
                <button
                  className="text-[#6A6A7C] hover:text-[#EF4444] transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444] rounded"
                  aria-label={`Desinstalar skill ${skill.name}`}
                >
                  <X size={13} strokeWidth={1.75} />
                </button>
              </div>
            ))}

            {/* Skills inactivas disponibles */}
            {SKILLS.filter(s => !s.active).map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-2 bg-[#101015] border border-[#1F1F29] rounded-[10px] px-3 py-2 opacity-60"
              >
                <PlugZap size={13} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
                <span className="text-[#6A6A7C] text-xs font-mono">{skill.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-5 h-px bg-[#1F1F29]" />

        {/* Historial de runs */}
        <div className="px-5 pt-5">
          <p className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium mb-3">
            Últimas ejecuciones
          </p>
          <div className="flex flex-col gap-0" role="list" aria-label="Historial de ejecuciones">
            {RUNS.map((run, index) => (
              <div key={run.id} role="listitem">
                <RunRow run={run} />
                {index < RUNS.length - 1 && (
                  <div className="ml-[calc(0.75rem+1.25rem+0.75rem)] h-px bg-[#1F1F29]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RunRow
// ---------------------------------------------------------------------------

const RUN_STATUS_ICONS = {
  success: { icon: CheckCircle2, color: "#22C55E" },
  error:   { icon: AlertCircle,  color: "#EF4444" },
  running: { icon: Play,         color: "#7C5CFF" },
};

function RunRow({ run }: { run: RunRecord }) {
  const { icon: StatusIcon, color } = RUN_STATUS_ICONS[run.status];

  return (
    <div className="flex items-center gap-3 py-3.5">
      <StatusIcon size={18} strokeWidth={1.75} style={{ color }} className="flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-[#F4F4F7] text-sm font-medium leading-snug truncate">{run.trigger}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock size={11} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
          <span className="text-[#6A6A7C] text-xs">{run.duration}</span>
          <span className="text-[#2A2A36] text-xs">·</span>
          <span className="text-[#6A6A7C] text-xs font-mono">{formatTokens(run.tokens)} tokens</span>
        </div>
      </div>
      <span className="text-[#6A6A7C] text-xs flex-shrink-0">{run.timestamp}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
