/**
 * NEXUS V2 — Pantalla 07: Borrador Financiero — Detalle
 * Ruta: /m/finanzas/borrador/:txId
 *
 * Transacción: Netflix $47.900 detectada por Gmail.
 * Pantalla crítica: aprobación humana explícita (Human-in-the-Loop).
 */

import {
  ArrowLeft, Receipt, Mail, RefreshCcw, Music,
  CheckCircle2, XCircle, Edit3, ChevronRight,
  Shield, Zap, Calendar, AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

const DRAFT = {
  id: "txn_2026_0528_001",
  merchant: "Netflix",
  amount: -47900,
  date: "Miércoles 28 mayo 2026",
  time: "08:14 a.m.",
  category: "Suscripciones",
  confidence: 97,
  channel: "gmail" as const,
  recurring: true,
  recurringFrequency: "Mensual",
  lastOccurrence: "28 abr 2026",
  gmailSnippet: {
    from: "Netflix <info@mailer.netflix.com>",
    subject: "Confirmación de pago — tu plan Netflix Premium",
    preview: "Hola Jerson, confirmamos el cobro de COP $47.900 de tu tarjeta terminada en **4521** por tu suscripción Netflix Premium. Fecha: 28 de mayo de 2026...",
    highlightedAmount: "COP $47.900",
    highlightedDate: "28 de mayo de 2026",
  },
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function BorradorDetalle() {
  const isExpense = DRAFT.amount < 0;
  const amountColor = isExpense ? "#EF4444" : "#22C55E";
  const confidenceColor =
    DRAFT.confidence >= 90 ? "#22C55E" : DRAFT.confidence >= 70 ? "#F59E0B" : "#EF4444";

  return (
    <div
      className="flex flex-col min-h-screen bg-[#07070A] text-[#F4F4F7]"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4">
        <a
          href="/m/finanzas"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Volver a finanzas"
        >
          <ArrowLeft size={20} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </a>
        <h1 className="flex-1 text-[#F4F4F7] text-base font-semibold">Revisar borrador</h1>
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1A1A22] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          aria-label="Editar antes de aprobar"
        >
          <Edit3 size={18} strokeWidth={1.75} className="text-[#A8A8B8]" />
        </button>
      </header>

      {/* ── Contenido scrollable ─────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+100px)]"
        aria-label="Detalle del borrador financiero"
      >

        {/* ── Card principal — monto y comercio ─────────────────── */}
        <div className="bg-[#101015] border border-[#1F1F29] rounded-[20px] p-5 mb-4">
          {/* Icono y nombre */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isExpense ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.10)" }}
            >
              <Music size={28} strokeWidth={1.5} style={{ color: amountColor }} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[#F4F4F7] text-xl font-bold leading-tight">{DRAFT.merchant}</p>
              <p className="text-[#6A6A7C] text-sm">{DRAFT.category}</p>
            </div>
          </div>

          {/* Monto */}
          <p
            className="text-[2.5rem] font-bold leading-none tracking-tight mb-1"
            style={{
              fontFamily: "'Space Grotesk', var(--font-sans)",
              color: amountColor,
            }}
            aria-label={`Monto: ${isExpense ? "egreso de" : "ingreso de"} ${formatCOP(DRAFT.amount)}`}
          >
            {isExpense ? "-" : "+"}COP {Math.abs(DRAFT.amount).toLocaleString("es-CO")}
          </p>

          {/* Fecha y hora */}
          <div className="flex items-center gap-1.5">
            <Calendar size={13} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
            <p className="text-[#A8A8B8] text-sm">{DRAFT.date} · {DRAFT.time}</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#1F1F29] my-4" />

          {/* Meta: confianza + recurrente */}
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px]"
              style={{ backgroundColor: `${confidenceColor}15` }}
            >
              <Zap size={12} strokeWidth={1.75} style={{ color: confidenceColor }} aria-hidden="true" />
              <span className="text-xs font-semibold" style={{ color: confidenceColor }}>
                {DRAFT.confidence}% confianza IA
              </span>
            </div>

            {DRAFT.recurring && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[#F59E0B15]">
                <RefreshCcw size={12} strokeWidth={1.75} className="text-[#F59E0B]" aria-hidden="true" />
                <span className="text-xs font-semibold text-[#F59E0B]">
                  Recurrente · {DRAFT.recurringFrequency}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[#1A1A22]">
              <Mail size={12} strokeWidth={1.75} className="text-[#6A6A7C]" aria-hidden="true" />
              <span className="text-xs text-[#6A6A7C]">Gmail</span>
            </div>
          </div>
        </div>

        {/* ── Evidencia — snippet del correo ───────────────────── */}
        <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail size={14} strokeWidth={1.75} className="text-[#A8A8B8]" aria-hidden="true" />
            <p className="text-[#A8A8B8] text-xs font-semibold uppercase tracking-widest">Evidencia</p>
          </div>

          {/* Email header */}
          <div className="mb-2">
            <p className="text-[#6A6A7C] text-xs">De: <span className="text-[#A8A8B8]">{DRAFT.gmailSnippet.from}</span></p>
            <p className="text-[#6A6A7C] text-xs mt-0.5">Asunto: <span className="text-[#A8A8B8] font-medium">{DRAFT.gmailSnippet.subject}</span></p>
          </div>

          {/* Snippet con highlights */}
          <div className="bg-[#1A1A22] rounded-[10px] p-3">
            <p className="text-[#A8A8B8] text-xs leading-relaxed">
              {DRAFT.gmailSnippet.preview.split(DRAFT.gmailSnippet.highlightedAmount).map((part, i, arr) => (
                <span key={i}>
                  {part.split(DRAFT.gmailSnippet.highlightedDate).map((datePart, j, dateArr) => (
                    <span key={j}>
                      {datePart}
                      {j < dateArr.length - 1 && (
                        <span className="bg-[#F59E0B20] text-[#F59E0B] font-semibold px-0.5 rounded">
                          {DRAFT.gmailSnippet.highlightedDate}
                        </span>
                      )}
                    </span>
                  ))}
                  {i < arr.length - 1 && (
                    <span className="bg-[#22C55E20] text-[#22C55E] font-semibold px-0.5 rounded">
                      {DRAFT.gmailSnippet.highlightedAmount}
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* ── Clasificación IA ─────────────────────────────────── */}
        <div className="bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} strokeWidth={1.75} className="text-[#A8A8B8]" aria-hidden="true" />
            <p className="text-[#A8A8B8] text-xs font-semibold uppercase tracking-widest">Clasificación IA</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F4F4F7] text-sm font-semibold">{DRAFT.category}</p>
              <p className="text-[#6A6A7C] text-xs mt-0.5">Última ocurrencia: {DRAFT.lastOccurrence}</p>
            </div>
            <button
              className="flex items-center gap-1.5 text-[#7C5CFF] text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] rounded px-1"
              aria-label="Cambiar categoría de esta transacción"
            >
              Cambiar
              <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Toggle recurrente ────────────────────────────────── */}
        <div className="flex items-center justify-between bg-[#101015] border border-[#1F1F29] rounded-[14px] p-4 mb-6">
          <div>
            <p className="text-[#F4F4F7] text-sm font-medium">Marcar como recurrente</p>
            <p className="text-[#6A6A7C] text-xs mt-0.5">El agente esperará este cargo cada mes</p>
          </div>
          {/* Toggle on */}
          <div
            className="w-12 h-7 rounded-full bg-[#7C5CFF] relative flex items-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A]"
            role="switch"
            aria-checked="true"
            aria-label="Marcar como recurrente"
            tabIndex={0}
          >
            <div className="absolute right-1 w-5 h-5 bg-white rounded-full shadow-sm" />
          </div>
        </div>

        {/* ── Aviso privacidad ─────────────────────────────────── */}
        <div className="flex items-start gap-2.5 px-1 mb-2">
          <Shield size={14} strokeWidth={1.75} className="text-[#6A6A7C] mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-[#6A6A7C] text-xs leading-relaxed">
            Tu data se queda en tu VPS. El agente no comparte esta información con terceros.
          </p>
        </div>
      </main>

      {/* ── Acciones fijas en bottom ─────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 bg-[#07070A] border-t border-[#1F1F29] px-5 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="flex gap-3">
          {/* Rechazar */}
          <button
            className="flex-1 flex items-center justify-center gap-2 bg-[#EF44441A] border border-[#EF444430] text-[#EF4444] rounded-[14px] py-4 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444] transition-colors hover:bg-[#EF44441A]"
            aria-label="Rechazar esta transacción"
          >
            <XCircle size={18} strokeWidth={1.75} aria-hidden="true" />
            Rechazar
          </button>

          {/* Aprobar */}
          <button
            className="flex-[2] flex items-center justify-center gap-2 bg-[#22C55E] text-white rounded-[14px] py-4 font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070A] transition-colors hover:bg-[#16A34A]"
            style={{ boxShadow: "0 8px 24px rgba(34,197,94,0.25)" }}
            aria-label="Aprobar esta transacción"
          >
            <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
            Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatCOP(amount: number): string {
  const abs = Math.abs(amount);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(abs);
}
