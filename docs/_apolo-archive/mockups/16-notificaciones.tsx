/**
 * NEXUS V2 — Pantalla 16: Notificaciones
 * Ruta: /m/notificaciones (accesible desde Bell en el home)
 */

import {
  ArrowLeft, Bell, Receipt, FolderKanban, Zap,
  AlertTriangle, CheckCircle2, Wallet, Bot,
  CircleDollarSign, Clock, X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

type NotifType = "borrador" | "run_complete" | "run_error" | "quota" | "tarea_vencida" | "sistema";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionHref?: string;
  urgent?: boolean;
}

const NOTIFICATIONS: Notification[] = [
  // Hoy
  {
    id: "n1",
    type: "borrador",
    title: "Nuevo borrador: Netflix",
    body: "El agente detectó un cargo de COP $47.900. Pendiente de aprobación.",
    timestamp: "Hoy 08:14",
    read: false,
    actionHref: "/m/finanzas/borrador/txn_2026_0528_001",
  },
  {
    id: "n2",
    type: "borrador",
    title: "2 borradores nuevos",
    body: "Mercado Libre (-$185.000) y un ingreso de cliente (+$2.400.000). Revísalos.",
    timestamp: "Ayer 22:30",
    read: false,
    actionHref: "/m/finanzas",
  },
  {
    id: "n3",
    type: "tarea_vencida",
    title: "Tarea vencida",
    body: "\"Mockups desktop (3 variantes)\" del proyecto Amparo venció hoy.",
    timestamp: "Hoy 00:00",
    read: false,
    actionHref: "/m/proyectos/p1",
    urgent: true,
  },
  // Ayer
  {
    id: "n4",
    type: "run_complete",
    title: "APOLO completó la tarea",
    body: "\"Plan de diseño NEXUS V2\" completado en 18m 42s — 85.4k tokens.",
    timestamp: "Ayer 14:22",
    read: true,
    actionHref: "/m/agentes/apolo",
  },
  {
    id: "n5",
    type: "quota",
    title: "Quota al 78%",
    body: "Llevas 3.9k de 5k mensajes este mes. Te quedan ~6 días al ritmo actual.",
    timestamp: "Ayer 09:00",
    read: true,
    actionHref: "/m/upgrade",
    urgent: false,
  },
  // Esta semana
  {
    id: "n6",
    type: "run_error",
    title: "Error en web-scraper",
    body: "La skill web-scraper falló con código MCP-404. El agente intentará autocure en la próxima ejecución.",
    timestamp: "26 may",
    read: true,
    actionHref: "/m/agentes/apolo",
    urgent: true,
  },
  {
    id: "n7",
    type: "sistema",
    title: "Conexión Gmail renovada",
    body: "Tu token de Gmail fue renovado automáticamente. Conexión activa hasta 27 jun.",
    timestamp: "25 may",
    read: true,
  },
];

const NOTIF_GROUPS = [
  { label: "Hoy",          ids: ["n1", "n2", "n3"] },
  { label: "Ayer",         ids: ["n4", "n5"] },
  { label: "Esta semana",  ids: ["n6", "n7"] },
];

const TYPE_CONFIG: Record<NotifType, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  borrador:      { icon: Receipt,      color: "#F59E0B",  bg: "rgba(245,158,11,0.12)" },
  run_complete:  { icon: CheckCircle2, color: "#22C55E",  bg: "rgba(34,197,94,0.12)" },
  run_error:     { icon: AlertTriangle,color: "#EF4444",  bg: "rgba(239,68,68,0.12)" },
  quota:         { icon: CircleDollarSign, color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  tarea_vencida: { icon: Clock,        color: "#EF4444",  bg: "rgba(239,68,68,0.12)" },
  sistema:       { icon: Zap,          color: "#60A5FA",  bg: "rgba(96,165,250,0.12)" },
};

const unreadCount = NOTIFICATIONS.filter(n => !n.read).length;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function Notificaciones() {
  const notifById = Object.fromEntries(NOTIFICATIONS.map(n => [n.id, n]));

  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a href="/m/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label="Volver">
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="text-[#F4F4F7] text-base font-semibold flex-1">
          Notificaciones
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#7C5CFF] text-white text-[10px] font-bold align-text-top">
              {unreadCount}
            </span>
          )}
        </h1>
        <button
          className="text-[#7C5CFF] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1"
          aria-label="Marcar todas como leídas"
        >
          Leer todo
        </button>
      </header>

      {/* ── Lista agrupada ───────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+24px)]" aria-label="Lista de notificaciones">
        {NOTIF_GROUPS.map((group) => {
          const groupNotifs = group.ids.map(id => notifById[id]).filter(Boolean);
          if (!groupNotifs.length) return null;

          return (
            <section key={group.label} aria-labelledby={`group-${group.label}`}>
              <div className="px-5 py-2.5">
                <p id={`group-${group.label}`} className="text-[#6A6A7C] text-xs uppercase tracking-widest font-medium">
                  {group.label}
                </p>
              </div>
              <div role="list">
                {groupNotifs.map((notif) => (
                  <div key={notif.id} role="listitem">
                    <NotificationRow notif={notif} />
                    <div className="mx-5 h-px bg-[#1F1F29]" />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationRow
// ---------------------------------------------------------------------------

function NotificationRow({ notif }: { notif: Notification }) {
  const { icon: Icon, color, bg } = TYPE_CONFIG[notif.type];

  return (
    <a
      href={notif.actionHref ?? "#"}
      className={`flex items-start gap-3 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-inset
        ${notif.read ? "hover:bg-[#101015]" : "bg-[#7C5CFF05] hover:bg-[#7C5CFF0A]"}`}
      aria-label={`${notif.title}. ${notif.body} ${notif.timestamp}.${!notif.read ? " No leída." : ""}`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div className="w-2 h-2 rounded-full bg-[#7C5CFF] flex-shrink-0 mt-2" aria-label="No leída" />
      )}
      {notif.read && <div className="w-2 flex-shrink-0" aria-hidden="true" />}

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: bg }}
      >
        <Icon size={18} strokeWidth={1.75} style={{ color }} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className={`text-sm font-semibold leading-snug ${notif.read ? "text-[#A8A8B8]" : "text-[#F4F4F7]"}`}>
            {notif.title}
          </p>
          <span className="text-[#6A6A7C] text-[10px] flex-shrink-0 mt-0.5">{notif.timestamp}</span>
        </div>
        <p className="text-[#6A6A7C] text-xs leading-relaxed line-clamp-2">{notif.body}</p>
      </div>
    </a>
  );
}
