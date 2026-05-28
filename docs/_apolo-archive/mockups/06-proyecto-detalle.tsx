/**
 * NEXUS V2 — Pantalla 06: Proyecto Detalle
 * Ruta: /m/proyectos/:id
 *
 * Proyecto: "Rediseño landing Amparo"
 */

import {
  ArrowLeft, Bot, Calendar, CheckCircle2, Circle,
  Clock, Flag, MoreVertical, Plus, ChevronRight,
  FileText, Target, Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

const PROJECT = {
  id: "p1",
  name: "Rediseño landing Amparo",
  description: "Rediseño completo de la landing page de Amparo con nuevo sistema visual, sección de testimonios y pricing actualizado.",
  progress: 68,
  agentName: "Apolo",
  agentId: "apolo",
  targetDate: "31 may 2026",
  createdAt: "12 may 2026",
  status: "active" as const,
};

type TaskPriority = "high" | "medium" | "low";
type TaskStatus = "done" | "in_progress" | "pending";

interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  overdue?: boolean;
  assignedAgent?: string;
}

const TASKS: Task[] = [
  { id: "t1", title: "Auditoría visual landing actual",        priority: "high",   status: "done",        dueDate: "15 may" },
  { id: "t2", title: "Definir paleta + tokens design system",  priority: "high",   status: "done",        dueDate: "18 may" },
  { id: "t3", title: "Mockups mobile (8 pantallas)",           priority: "high",   status: "done",        dueDate: "22 may" },
  { id: "t4", title: "Mockups desktop (3 variantes)",          priority: "medium", status: "in_progress", dueDate: "28 may", overdue: true, assignedAgent: "Apolo" },
  { id: "t5", title: "Implementar nueva sección pricing",       priority: "high",   status: "pending",     dueDate: "29 may" },
  { id: "t6", title: "Copywriting hero + testimonios",         priority: "medium", status: "pending",     dueDate: "30 may" },
  { id: "t7", title: "QA mobile + desktop cross-browser",      priority: "medium", status: "pending",     dueDate: "31 may" },
  { id: "t8", title: "Deploy + merge a main",                  priority: "high",   status: "pending",     dueDate: "31 may" },
];

const LINKED_NOTES = [
  { id: "n8", title: "Feedback UI Amparo — patrones Apple",    modifiedAt: "24 may" },
  { id: "n1", title: "Decisiones Amparo RAG",                  modifiedAt: "Hoy" },
];

type ActiveTab = "tareas" | "notas";

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function ProyectoDetalle() {
  const activeTab: ActiveTab = "tareas";
  const done  = TASKS.filter(t => t.status === "done").length;
  const total = TASKS.length;

  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <a
          href="/m/proyectos"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] transition-colors"
          aria-label="Volver a proyectos"
        >
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>

        <h1 className="flex-1 text-[#F4F4F7] text-base font-semibold leading-tight truncate">
          {PROJECT.name}
        </h1>

        <button
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] transition-colors"
          aria-label="Más opciones del proyecto"
        >
          <MoreVertical size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </button>
      </header>

      {/* ── Hero info ───────────────────────────────────────────── */}
      <div className="px-5 pb-4 border-b border-[#1F1F29]">
        {/* Progress */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[#F4F4F7] text-2xl font-bold">{PROJECT.progress}%</span>
            <span className="text-[#6A6A7C] text-sm">completado</span>
          </div>
          <span className="text-[#A8A8B8] text-sm font-medium font-mono">{done}/{total} tareas</span>
        </div>

        <div className="h-2 bg-[#1A1A22] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[#7C5CFF] rounded-full transition-all"
            style={{ width: `${PROJECT.progress}%` }}
            role="progressbar"
            aria-valuenow={PROJECT.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-3">
          {/* Agente */}
          <div className="flex items-center gap-1.5 bg-[#7C5CFF1A] rounded-[10px] px-3 py-1.5">
            <Bot size={13} strokeWidth={1.75} className="text-[#7C5CFF]" aria-hidden="true" />
            <span className="text-[#7C5CFF] text-xs font-medium">{PROJECT.agentName}</span>
          </div>

          {/* Fecha objetivo */}
          <div className="flex items-center gap-1.5 bg-[#1A1A22] rounded-[10px] px-3 py-1.5">
            <Target size={13} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <span className="text-[#A8A8B8] text-xs">{PROJECT.targetDate}</span>
          </div>

          {/* Creado */}
          <div className="flex items-center gap-1.5 bg-[#1A1A22] rounded-[10px] px-3 py-1.5">
            <Calendar size={13} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <span className="text-[#A8A8B8] text-xs">Desde {PROJECT.createdAt}</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#1F1F29]" role="tablist" aria-label="Secciones del proyecto">
        {(["tareas", "notas"] as ActiveTab[]).map((tab) => {
          const isActive = tab === activeTab;
          const labels = { tareas: "Tareas", notas: "Notas del vault" };
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              className={`flex-1 py-3.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-inset
                ${isActive
                  ? "border-[#7C5CFF] text-[#7C5CFF]"
                  : "border-transparent text-[#6A6A7C] hover:text-[#A8A8B8]"}`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Contenido ───────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+80px)]"
        role="tabpanel"
        aria-label="Lista de tareas del proyecto"
      >
        {/* Header de sección */}
        <div className="flex items-center justify-between px-5 py-3">
          <p className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium">
            {TASKS.filter(t => t.status !== "done").length} pendientes · {done} completadas
          </p>
          <button
            className="flex items-center gap-1.5 text-[#7C5CFF] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1"
            aria-label="Agregar nueva tarea"
          >
            <Plus size={14} strokeWidth={2} />
            Agregar
          </button>
        </div>

        {/* Lista de tareas */}
        <div role="list" aria-label="Tareas del proyecto">
          {TASKS.map((task, index) => (
            <div key={task.id} role="listitem">
              <TaskRow task={task} />
              {index < TASKS.length - 1 && (
                <div className="ml-[calc(1rem+1.75rem+0.75rem)] h-px bg-[#1F1F29]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Notas vinculadas (preview, acceso rápido) */}
        <div className="px-5 mt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium">Notas del vault</p>
            <button className="text-[#7C5CFF] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1">
              Ver todo
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {LINKED_NOTES.map((note) => (
              <a
                key={note.id}
                href={`/m/vault/${note.id}`}
                className="flex items-center gap-3 bg-[#101015] border border-[#1F1F29] rounded-[10px] px-4 py-3 hover:border-[#2A2A36] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
                aria-label={`Nota: ${note.title}, modificada ${note.modifiedAt}`}
              >
                <FileText size={16} strokeWidth={1.75} className="text-[#6A6A7C] flex-shrink-0" aria-hidden="true" />
                <span className="flex-1 text-sm text-[#A8A8B8] truncate">{note.title}</span>
                <span className="text-xs text-[#6A6A7C] flex-shrink-0">{note.modifiedAt}</span>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* ── FAB ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] right-5 z-10">
        <button
          className="w-14 h-14 rounded-full bg-[#7C5CFF] flex items-center justify-center shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-4 focus-visible:ring-offset-[#07070A]"
          style={{ boxShadow: "0 8px 24px rgba(124,92,255,0.40)" }}
          aria-label="Crear nueva tarea en este proyecto"
        >
          <Plus size={24} strokeWidth={2} className="text-white" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#6A6A7C",
};

function TaskRow({ task }: { task: Task }) {
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";

  return (
    <button
      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-inset text-left"
      aria-label={`Tarea: ${task.title}. Estado: ${isDone ? "completada" : isInProgress ? "en progreso" : "pendiente"}${task.overdue ? ". Atrasada" : ""}`}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        {isDone ? (
          <CheckCircle2 size={20} strokeWidth={1.75} className="text-[#22C55E]" aria-hidden="true" />
        ) : (
          <Circle
            size={20}
            strokeWidth={1.75}
            className={isInProgress ? "text-[#7C5CFF]" : "text-[#2A2A36]"}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${isDone ? "text-[#6A6A7C] line-through" : "text-[#F4F4F7]"}`}>
          {task.title}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          {/* Priority dot */}
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
            aria-label={`Prioridad ${task.priority}`}
          />

          {/* Due date */}
          {task.dueDate && (
            <span className={`text-xs ${task.overdue ? "text-[#EF4444] font-semibold" : "text-[#6A6A7C]"}`}>
              {task.overdue ? "Vencido · " : ""}{task.dueDate}
            </span>
          )}

          {/* Agent badge */}
          {task.assignedAgent && (
            <>
              <span className="text-[#2A2A36] text-xs">·</span>
              <span className="text-[#7C5CFF] text-xs">{task.assignedAgent}</span>
            </>
          )}

          {/* In progress pill */}
          {isInProgress && (
            <span className="bg-[#7C5CFF1A] text-[#7C5CFF] text-[10px] font-semibold px-2 py-0.5 rounded-full">
              En curso
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} strokeWidth={1.75} className="text-[#2A2A36] flex-shrink-0 mt-0.5" aria-hidden="true" />
    </button>
  );
}
