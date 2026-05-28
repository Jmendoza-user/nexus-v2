/**
 * DomainCards — ProjectCard, VaultNoteCard, AgentCard, QuotaBar, OAuthConnectButton, OnboardingStep
 *
 * @example
 * ```tsx
 * <ProjectCard project={project} onClick={() => navigate(`/m/proyectos/${project.id}`)} />
 * <QuotaBar label="Mensajes IA" used={3900} total={5000} unit="msgs" />
 * <OAuthConnectButton provider="gmail" status="connected" onConnect={handleConnect} onDisconnect={handleDisconnect} />
 * <OnboardingStep step={3} totalSteps={8} title="Configura tu perfil" />
 * ```
 */

import React from "react";
import {
  FolderKanban, Bot, Target, Calendar, CheckCircle2,
  Hash, Link2, Clock, BookOpen, Zap, PlugZap,
  Mail, MessageCircle, ShoppingBag, CheckCircle, Plus, RefreshCcw,
  AlertTriangle, Sparkles, ChevronRight, CircleAlert,
} from "lucide-react";

// ---------------------------------------------------------------------------
// ProjectCard
// ---------------------------------------------------------------------------

export interface ProjectCardData {
  id: string;
  name: string;
  progress: number;
  agentName: string;
  nextTask: string;
  targetDate: string;
  overdue?: boolean;
}

export function ProjectCard({ project, onClick }: { project: ProjectCardData; onClick?: () => void }) {
  const progressColor = project.overdue ? "#EF4444" : project.progress >= 100 ? "#22C55E" : "#7C5CFF";

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className="bg-bg-surface border border-border-subtle rounded-lg p-4 cursor-pointer hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Proyecto ${project.name}, ${project.progress}% completado`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            {project.overdue && <CircleAlert size={13} strokeWidth={1.75} className="text-danger flex-shrink-0" aria-label="Atrasado" />}
            <h3 className="text-text-primary text-sm font-semibold leading-tight truncate">{project.name}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Bot size={11} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
            <span className="text-text-tertiary text-xs">{project.agentName}</span>
          </div>
        </div>
        <ChevronRight size={16} strokeWidth={1.75} className="text-text-tertiary flex-shrink-0 mt-0.5" aria-hidden="true" />
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <span className="text-text-tertiary text-xs">Progreso</span>
          <span className="text-xs font-semibold" style={{ color: progressColor }}>{project.progress}%</span>
        </div>
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${project.progress}%`, backgroundColor: progressColor }}
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Target size={12} strokeWidth={1.75} className="text-text-tertiary flex-shrink-0" aria-hidden="true" />
        <p className="text-text-secondary text-xs truncate flex-1">{project.nextTask}</p>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <Calendar size={11} strokeWidth={1.75} className={project.overdue ? "text-danger" : "text-text-tertiary"} aria-hidden="true" />
        <span className={`text-xs ${project.overdue ? "text-danger font-semibold" : "text-text-tertiary"}`}>
          {project.overdue ? "Vencido · " : ""}{project.targetDate}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VaultNoteCard
// ---------------------------------------------------------------------------

export interface VaultNoteCardData {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  backlinks: number;
  modifiedAt: string;
  folderColor?: string;
  folder?: string;
}

export function VaultNoteCard({ note, onClick }: { note: VaultNoteCardData; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className="bg-bg-surface border border-border-subtle rounded-lg p-3.5 cursor-pointer hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Nota: ${note.title}`}
    >
      {note.folder && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: note.folderColor ?? "#7C5CFF" }} aria-hidden="true" />
          <span className="text-[10px] font-medium" style={{ color: note.folderColor ?? "#7C5CFF" }}>{note.folder}</span>
        </div>
      )}
      <h3 className="text-text-primary text-sm font-semibold leading-snug mb-2 line-clamp-2">{note.title}</h3>
      <p className="text-text-tertiary text-xs leading-relaxed mb-3 line-clamp-3">{note.excerpt}</p>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className="flex items-center gap-0.5 bg-bg-elevated text-text-tertiary text-[10px] rounded-sm px-1.5 py-0.5">
              <Hash size={9} strokeWidth={1.75} aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        {note.backlinks > 0 && (
          <div className="flex items-center gap-1">
            <Link2 size={11} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
            <span className="text-[10px] text-text-tertiary">{note.backlinks}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Clock size={11} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
          <span className="text-[10px] text-text-tertiary">{note.modifiedAt}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentCard
// ---------------------------------------------------------------------------

export interface AgentCardData {
  id: string;
  name: string;
  description: string;
  status: "idle" | "running" | "paused" | "error";
  activeSkills: number;
  lastRun?: string;
}

const AGENT_STATUS: Record<AgentCardData["status"], { color: string; label: string }> = {
  idle:    { color: "#A8A8B8", label: "Inactivo" },
  running: { color: "#7C5CFF", label: "Ejecutando" },
  paused:  { color: "#F59E0B", label: "Pausado" },
  error:   { color: "#EF4444", label: "Error" },
};

export function AgentCard({ agent, onClick }: { agent: AgentCardData; onClick?: () => void }) {
  const { color, label } = AGENT_STATUS[agent.status];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className="bg-bg-surface border border-border-subtle rounded-lg p-4 cursor-pointer hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Agente ${agent.name}, estado: ${label}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-accent to-[#5B3ECC] flex items-center justify-center flex-shrink-0">
          <Bot size={18} strokeWidth={1.5} className="text-white" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-text-primary text-sm font-semibold">{agent.name}</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
            </div>
          </div>
          <p className="text-text-tertiary text-xs line-clamp-2 leading-relaxed">{agent.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <Zap size={12} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
          <span className="text-text-secondary text-xs">{agent.activeSkills} skills</span>
        </div>
        {agent.lastRun && (
          <>
            <span className="text-border-strong text-xs">·</span>
            <div className="flex items-center gap-1.5">
              <Clock size={12} strokeWidth={1.75} className="text-text-tertiary" aria-hidden="true" />
              <span className="text-text-tertiary text-xs">{agent.lastRun}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuotaBar
// ---------------------------------------------------------------------------

export interface QuotaBarProps {
  label: string;
  used: number;
  total: number;
  unit: string;
  showWarning?: boolean;
}

export function QuotaBar({ label, used, total, unit, showWarning }: QuotaBarProps) {
  const pct = Math.min(Math.round((used / total) * 100), 100);
  const barColor = pct >= 100 ? "#EF4444" : pct >= 80 ? "#F59E0B" : "#7C5CFF";

  const formatN = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-text-secondary text-xs">{label}</span>
        <span className="text-text-tertiary text-xs font-mono">{formatN(used)} / {formatN(total)} {unit}</span>
      </div>
      <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${label}: ${pct}% usado`}
        />
      </div>
      {(pct >= 80 || showWarning) && (
        <p className="text-xs mt-1" style={{ color: barColor }}>
          {pct >= 100
            ? "Límite alcanzado. Mejora tu plan para continuar."
            : `${pct}% usado — quedan ${formatN(total - used)} ${unit}.`}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OAuthConnectButton
// ---------------------------------------------------------------------------

export type OAuthProvider = "gmail" | "gcalendar" | "telegram" | "mercadopago";
export type ConnStatus    = "connected" | "disconnected" | "expiring" | "error";

const PROVIDER_META: Record<OAuthProvider, { name: string; icon: React.ComponentType<any>; color: string; bg: string }> = {
  gmail:       { name: "Gmail",           icon: Mail,            color: "#EA4335", bg: "rgba(234,67,53,0.10)" },
  gcalendar:   { name: "Google Calendar", icon: Calendar,        color: "#4285F4", bg: "rgba(66,133,244,0.10)" },
  telegram:    { name: "Telegram",        icon: MessageCircle,   color: "#229ED9", bg: "rgba(34,158,217,0.10)" },
  mercadopago: { name: "MercadoPago",     icon: ShoppingBag,     color: "#009EE3", bg: "rgba(0,158,227,0.10)" },
};

export interface OAuthConnectButtonProps {
  provider: OAuthProvider;
  status: ConnStatus;
  account?: string;
  expiresIn?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function OAuthConnectButton({ provider, status, account, expiresIn, onConnect, onDisconnect }: OAuthConnectButtonProps) {
  const meta = PROVIDER_META[provider];
  const isConnected = status === "connected" || status === "expiring";

  return (
    <div className="flex items-center gap-3 bg-bg-surface border border-border-subtle rounded-lg px-4 py-3.5">
      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg }}>
        <meta.icon size={20} strokeWidth={1.5} style={{ color: meta.color }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-sm font-semibold">{meta.name}</p>
        {account && <p className="text-text-tertiary text-xs truncate">{account}</p>}
        {status === "expiring" && expiresIn && (
          <p className="text-warning text-xs">Expira en {expiresIn}</p>
        )}
        {status === "error" && (
          <p className="text-danger text-xs flex items-center gap-1">
            <AlertTriangle size={11} strokeWidth={1.75} aria-hidden="true" />
            Error de conexión
          </p>
        )}
      </div>
      {isConnected ? (
        <button
          onClick={onDisconnect}
          className="flex-shrink-0 text-text-tertiary text-xs border border-border-strong rounded-[8px] px-3 py-1.5 hover:border-danger hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          aria-label={`Desconectar ${meta.name}`}
        >
          Desconectar
        </button>
      ) : (
        <button
          onClick={onConnect}
          className="flex-shrink-0 flex items-center gap-1.5 bg-accent/10 text-accent text-xs font-semibold px-3 py-1.5 rounded-[8px] hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Conectar ${meta.name}`}
        >
          <Plus size={12} strokeWidth={2} />
          Conectar
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OnboardingStep
// ---------------------------------------------------------------------------

export interface OnboardingStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function OnboardingStep({ step, totalSteps, title, description, children }: OnboardingStepProps) {
  return (
    <div className="flex flex-col min-h-screen bg-bg-base px-6">
      {/* Dots progress */}
      <div
        className="flex items-center justify-center gap-2 pt-[calc(env(safe-area-inset-top,0px)+24px)] pb-8"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Paso ${step} de ${totalSteps}`}
      >
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-[280ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
              ${i + 1 === step
                ? "w-6 h-2 bg-accent"
                : i + 1 < step
                ? "w-2 h-2 bg-accent/40"
                : "w-2 h-2 bg-border-strong"
              }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h2
          className="text-text-primary text-3xl font-bold mb-3 leading-tight"
          style={{ fontFamily: "'Space Grotesk', var(--font-sans)" }}
        >
          {title}
        </h2>
        {description && (
          <p className="text-text-secondary text-base leading-relaxed mb-8">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}
