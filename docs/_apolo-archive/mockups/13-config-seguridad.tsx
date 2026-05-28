/**
 * NEXUS V2 — Pantalla 13: Config — Seguridad y Privacidad
 * Ruta: /m/config/seguridad
 */

import { ArrowLeft, Shield, Eye, EyeOff, Trash2, AlertTriangle, ChevronRight, Lock } from "lucide-react";

interface RedactionRecord {
  id: string;
  type: string;
  value: string;
  context: string;
  timestamp: string;
}

const REDACTIONS: RedactionRecord[] = [
  { id: "r1", type: "Tarjeta de crédito", value: "****-****-****-4521", context: "Correo Netflix detección",       timestamp: "Hoy 08:14" },
  { id: "r2", type: "IBAN / Cuenta",      value: "CO****8742",           context: "Consulta historial financiero",  timestamp: "Ayer 19:32" },
  { id: "r3", type: "Contraseña",         value: "[redactada]",          context: "Nota vault — acceso VPS",       timestamp: "26 may" },
  { id: "r4", type: "Número celular",     value: "+57 310 ***-****",     context: "Agenda / contactos sync",       timestamp: "25 may" },
  { id: "r5", type: "Tarjeta de crédito", value: "****-****-****-9933", context: "Correo MercadoLibre cargo",      timestamp: "24 may" },
];

export default function ConfigSeguridad() {
  const tokenGuardActive = true;

  return (
    <div className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]" style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a href="/m/cuenta" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]" aria-label="Volver">
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="text-[#F4F4F7] text-base font-semibold flex-1">Seguridad y privacidad</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-10 space-y-5">

        {/* TokenGuard toggle */}
        <section aria-labelledby="tokenguard-label">
          <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 ${tokenGuardActive ? "bg-[#7C5CFF1A]" : "bg-[#1A1A22]"}`}>
                <Shield size={20} strokeWidth={1.75} className={tokenGuardActive ? "text-[#7C5CFF]" : "text-[#6A6A7C]"} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p id="tokenguard-label" className="text-[#F4F4F7] text-base font-semibold">TokenGuard</p>
                  {/* Toggle */}
                  <div
                    className={`w-12 h-7 rounded-full relative flex items-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A] ${tokenGuardActive ? "bg-[#7C5CFF] focus-visible:ring-[#7C5CFF]" : "bg-[#2A2A36] focus-visible:ring-[#2A2A36]"}`}
                    role="switch"
                    aria-checked={tokenGuardActive}
                    aria-label="Activar TokenGuard"
                    tabIndex={0}
                  >
                    <div className={`absolute w-5 h-5 bg-white rounded-full shadow transition-all ${tokenGuardActive ? "right-1" : "left-1"}`} />
                  </div>
                </div>
                <p className="text-[#A8A8B8] text-sm leading-relaxed">Detecta y oculta automáticamente datos sensibles (tarjetas, contraseñas, IBANs) antes de enviarlos al modelo IA.</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Lock size={12} strokeWidth={1.75} className="text-[#22C55E]" aria-hidden="true" />
                  <span className="text-[#22C55E] text-xs font-medium">Tu data se queda en tu VPS</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Redaction log */}
        <section aria-labelledby="redactions-label">
          <div className="flex items-center justify-between mb-3">
            <p id="redactions-label" className="text-[#A8A8B8] text-xs uppercase tracking-widest font-medium">Últimas redacciones ({REDACTIONS.length})</p>
            <span className="text-[#6A6A7C] text-xs">Solo tú puedes verlas</span>
          </div>
          <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] overflow-hidden" role="list" aria-label="Registro de datos redactados">
            {REDACTIONS.map((r, i) => (
              <div key={r.id} role="listitem">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <EyeOff size={16} strokeWidth={1.75} className="text-[#6A6A7C] flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#A8A8B8] text-sm font-medium">{r.type}</p>
                    <p className="text-[#6A6A7C] text-xs truncate">{r.context}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[#6A6A7C] text-xs font-mono">{r.value}</p>
                    <p className="text-[#6A6A7C] text-[10px]">{r.timestamp}</p>
                  </div>
                </div>
                {i < REDACTIONS.length - 1 && <div className="ml-[calc(1rem+1rem+0.75rem)] h-px bg-[#1F1F29]" />}
              </div>
            ))}
          </div>
        </section>

        {/* Zona de peligro */}
        <section aria-labelledby="danger-label">
          <p id="danger-label" className="text-[#EF4444] text-xs uppercase tracking-widest font-medium mb-3">Zona de peligro</p>
          <div className="bg-[#101015] border border-[#EF444430] rounded-[14px] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} strokeWidth={1.75} className="text-[#EF4444] flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-[#F4F4F7] text-sm font-semibold mb-1">Borrar mi cuenta</p>
                <p className="text-[#A8A8B8] text-sm leading-relaxed mb-4">
                  Esto eliminará tu vault, tus notas, tus conexiones y tus borradores. No se puede deshacer.
                </p>
                <button
                  className="flex items-center gap-2 bg-[#EF44441A] border border-[#EF444430] text-[#EF4444] text-sm font-semibold px-4 py-2.5 rounded-[10px] hover:bg-[#EF444425] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]"
                  aria-label="Iniciar proceso de borrado de cuenta"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                  Eliminar cuenta permanentemente
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
