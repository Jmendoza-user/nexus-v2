/**
 * NEXUS V2 — Pantalla 02: Proyectos
 * Ruta: /m/proyectos
 *
 * Estado: 4 proyectos activos, 2 en backlog.
 */

import { FolderKanban, Plus, Bot, ChevronRight, Calendar, Target, CircleAlert } from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

type ProjectStatus = "active" | "backlog" | "closed";

interface Project {
  id: string;
  name: string;
  progress: number;        // 0-100
  agentName: string;
  agentInitial: string;
  nextTask: string;
  targetDate: string;
  status: ProjectStatus;
  overdue: boolean;
}

const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Rediseño landing Amparo",
    progress: 68,
    agentName: "Apolo",
    agentInitial: "A",
    nextTask: "Subir mockups pantalla móvil",
    targetDate: "31 may",
    status: "active",
    overdue: false,
  },
  {
    id: "p2",
    name: "Integración HKA Ariadna",
    progress: 42,
    agentName: "Hefesto",
    agentInitial: "H",
    nextTask: "Resolver rangos sandbox (TODO-HKA-RANGOS)",
    targetDate: "2 jun",
    status: "active",
    overdue: false,
  },
  {
    id: "p3",
    name: "Quiniela Mundial 2026",
    progress: 91,
    agentName: "Hefesto",
    agentInitial: "H",
    nextTask: "Deploy DNS portal pagos",
    targetDate: "28 may",
    status: "active",
    overdue: true,
  },
  {
    id: "p4",
    name: "CRM Ágora — FOAL Uruguay",
    progress: 100,
    agentName: "Hefesto",
    agentInitial: "H",
    nextTask: "Preparar demo presentación España",
    targetDate: "15 jul",
    status: "active",
    overdue: false,
  },
  {
    id: "p5",
    name: "Módulo SG-SST Aleteia",
    progress: 0,
    agentName: "Sin asignar",
    agentInitial: "?",
    nextTask: "Definir schema tablas",
    targetDate: "30 jun",
    status: "backlog",
    overdue: false,
  },
  {
    id: "p6",
    name: "Asistente WebGPU Local-First",
    progress: 15,
    agentName: "Hefesto",
    agentInitial: "H",
    nextTask: "Esperar JSON device profile de Jerson",
    targetDate: "—",
    status: "backlog",
    overdue: false,
  },
];

type FilterTab = "active" | "backlog" | "closed";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function Proyectos() {
  const activeFilter: FilterTab = "active";
  const filtered = PROJECTS.filter((p) => p.status === activeFilter);

  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4">
        <h1 className="text-[#F4F4F7] text-2xl font-semibold tracking-tight">
          Proyectos
        </h1>
        {/* FAB en top-bar también para acceso rápido en thumb-zone no disponible */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#7C5CFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
          aria-label="Crear nuevo proyecto"
        >
          <Plus size={18} strokeWidth={2} className="text-white" />
        </button>
      </header>

      {/* ── Filtro segmentado ────────────────────────────────────── */}
      <div className="px-5 mb-4" role="tablist" aria-label="Filtrar proyectos">
        <div className="flex bg-[#101015] rounded-[10px] p-1 border border-[#1F1F29]">
          {(["active", "backlog", "closed"] as FilterTab[]).map((tab) => {
            const labels: Record<FilterTab, string> = { active: "Activos", backlog: "Backlog", closed: "Cerrados" };
            const isSelected = tab === activeFilter;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isSelected}
                className={`flex-1 py-2 text-xs font-medium rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]
                  ${isSelected
                    ? "bg-[#7C5CFF] text-white shadow-sm"
                    : "text-[#6A6A7C] hover:text-[#A8A8B8]"
                  }`}
              >
                {labels[tab]}
                {tab === "active" && <span className="ml-1.5 opacity-70">{PROJECTS.filter(p => p.status === "active").length}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista de proyectos ───────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]"
        role="tabpanel"
        aria-label="Lista de proyectos activos"
      >
        <div className="flex flex-col gap-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {/* Empty state (cuando no hay proyectos) */}
        {filtered.length === 0 && (
          <EmptyState />
        )}
      </main>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <TabBarMock activeTab="proyectos" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Card
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: Project }) {
  const progressColor =
    project.overdue
      ? "#EF4444"
      : project.progress >= 100
      ? "#22C55E"
      : "#7C5CFF";

  return (
    <a
      href={`/m/proyectos/${project.id}`}
      className="block bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] hover:border-[#2A2A36] transition-colors"
      aria-label={`${project.name}, ${project.progress}% completo, próxima tarea: ${project.nextTask}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            {project.overdue && (
              <CircleAlert size={14} strokeWidth={1.75} className="text-[#EF4444] flex-shrink-0" aria-label="Atrasado" />
            )}
            <h2 className="text-[#F4F4F7] text-base font-semibold leading-tight truncate">
              {project.name}
            </h2>
          </div>
          {/* Agente chip */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#1A1A22] border border-[#2A2A36] flex items-center justify-center">
              <Bot size={10} strokeWidth={1.75} className="text-[#A8A8B8]" />
            </div>
            <span className="text-xs text-[#6A6A7C]">{project.agentName}</span>
          </div>
        </div>
        <ChevronRight size={18} strokeWidth={1.75} className="text-[#6A6A7C] flex-shrink-0 mt-0.5" aria-hidden="true" />
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-[#6A6A7C]">Progreso</span>
          <span
            className="text-xs font-semibold"
            style={{ color: progressColor }}
          >
            {project.progress}%
          </span>
        </div>
        <div className="h-1.5 bg-[#1A1A22] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${project.progress}%`, backgroundColor: progressColor }}
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Próxima tarea */}
      <div className="flex items-start gap-2 mb-3">
        <Target size={14} strokeWidth={1.75} className="text-[#6A6A7C] mt-0.5 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-[#A8A8B8] leading-snug line-clamp-2 flex-1">
          {project.nextTask}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5">
        <Calendar size={12} strokeWidth={1.75} className={project.overdue ? "text-[#EF4444]" : "text-[#6A6A7C]"} aria-hidden="true" />
        <span className={`text-xs ${project.overdue ? "text-[#EF4444] font-semibold" : "text-[#6A6A7C]"}`}>
          {project.overdue ? "Vencido · " : ""}{project.targetDate}
        </span>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center pt-20 px-8 text-center">
      <FolderKanban size={48} strokeWidth={1} className="text-[#2A2A36] mb-6" aria-hidden="true" />
      <h3 className="text-[#F4F4F7] text-xl font-semibold mb-2">Sin proyectos activos</h3>
      <p className="text-[#6A6A7C] text-sm leading-relaxed mb-8">
        Crea tu primer proyecto y asigna un agente para que te ayude a gestionarlo.
      </p>
      <button
        className="flex items-center gap-2 bg-[#7C5CFF] text-white px-6 py-3 rounded-[28px] font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
        aria-label="Crear primer proyecto"
      >
        <Plus size={16} strokeWidth={2} />
        Crear proyecto
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Bar (reutilizable entre mockups)
// ---------------------------------------------------------------------------

import { Mic, Wallet, BookOpen, User } from "lucide-react";
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
