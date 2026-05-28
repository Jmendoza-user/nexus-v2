/**
 * NEXUS V2 — Pantalla 12: Config — Conexiones
 * Ruta: /m/config/conexiones
 */

import { ArrowLeft, Mail, Calendar, MessageCircle, ShoppingBag, RefreshCcw, Unplug, ChevronRight, Plus, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type ConnStatus = "connected" | "disconnected" | "expiring" | "error";

interface Connection {
  id: string;
  name: string;
  description: string;
  status: ConnStatus;
  account?: string;
  expiresIn?: string;
  lastSync?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
}

const CONNECTIONS: Connection[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Detección de transacciones y resúmenes",
    status: "connected",
    account: "jersonmendoza@gmail.com",
    lastSync: "Hoy 15:30",
    icon: Mail,
    iconBg: "#EA43351A",
    iconColor: "#EA4335",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    description: "Agenda, eventos y recordatorios",
    status: "expiring",
    account: "jersonmendoza@gmail.com",
    expiresIn: "3 días",
    lastSync: "Hoy 09:00",
    icon: Calendar,
    iconBg: "#4285F41A",
    iconColor: "#4285F4",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Notificaciones y comandos por voz",
    status: "connected",
    account: "@jersonm",
    lastSync: "Hace 5 min",
    icon: MessageCircle,
    iconBg: "#229ED91A",
    iconColor: "#229ED9",
  },
  {
    id: "mercadopago",
    name: "MercadoPago",
    description: "Cobros y pagos en COP/USD",
    status: "disconnected",
    icon: ShoppingBag,
    iconBg: "#009EE31A",
    iconColor: "#009EE3",
  },
];

export default function ConfigConexiones() {
  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a href="/m/cuenta" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label="Volver">
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="text-[#F4F4F7] text-base font-semibold flex-1">Conexiones</h1>
      </header>

      <p className="px-5 pb-4 text-[#6A6A7C] text-sm">Conecta tus servicios para que el agente pueda actuar en tu nombre de forma segura.</p>

      <main className="flex-1 overflow-y-auto px-5 pb-10">
        <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] overflow-hidden" role="list" aria-label="Servicios disponibles para conectar">
          {CONNECTIONS.map((conn, index) => (
            <div key={conn.id} role="listitem">
              <ConnectionRow connection={conn} />
              {index < CONNECTIONS.length - 1 && <div className="ml-[calc(1rem+2.75rem+0.75rem)] h-px bg-[#1F1F29]" />}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function ConnectionRow({ connection: c }: { connection: Connection }) {
  const statusConfig: Record<ConnStatus, { label: string; color: string; icon: React.ComponentType<any> }> = {
    connected:    { label: "Conectado",       color: "#22C55E", icon: CheckCircle2 },
    disconnected: { label: "Desconectado",    color: "#6A6A7C", icon: Unplug },
    expiring:     { label: `Expira en ${c.expiresIn}`, color: "#F59E0B", icon: Clock },
    error:        { label: "Error",           color: "#EF4444", icon: AlertTriangle },
  };

  const { label, color, icon: StatusIcon } = statusConfig[c.status];

  return (
    <div className="flex items-center gap-3 px-4 py-4">
      {/* Icono del servicio */}
      <div className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.iconBg }}>
        <c.icon size={22} strokeWidth={1.5} style={{ color: c.iconColor }} aria-hidden="true" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[#F4F4F7] text-sm font-semibold">{c.name}</p>
        {c.account ? (
          <p className="text-[#6A6A7C] text-xs truncate mt-0.5">{c.account}</p>
        ) : (
          <p className="text-[#6A6A7C] text-xs mt-0.5">{c.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <StatusIcon size={11} strokeWidth={1.75} style={{ color }} aria-hidden="true" />
          <span className="text-xs font-medium" style={{ color }}>{label}</span>
          {c.lastSync && (
            <>
              <span className="text-[#2A2A36] text-xs">·</span>
              <span className="text-[#6A6A7C] text-xs">Sync {c.lastSync}</span>
            </>
          )}
        </div>
      </div>

      {/* Acción */}
      {c.status === "connected" ? (
        <button className="flex-shrink-0 text-[#6A6A7C] text-xs font-medium border border-[#2A2A36] rounded-[8px] px-3 py-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]" aria-label={`Desconectar ${c.name}`}>
          Desconectar
        </button>
      ) : c.status === "expiring" ? (
        <button className="flex-shrink-0 flex items-center gap-1.5 bg-[#F59E0B1A] text-[#F59E0B] text-xs font-semibold px-3 py-1.5 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]" aria-label={`Reautorizar ${c.name}`}>
          <RefreshCcw size={12} strokeWidth={1.75} />
          Reautorizar
        </button>
      ) : (
        <button className="flex-shrink-0 flex items-center gap-1.5 bg-[#7C5CFF1A] text-[#7C5CFF] text-xs font-semibold px-3 py-1.5 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label={`Conectar ${c.name}`}>
          <Plus size={12} strokeWidth={2} />
          Conectar
        </button>
      )}
    </div>
  );
}
