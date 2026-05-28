/**
 * TransactionDraftCard — Card con swipe actions (framer-motion)
 *
 * Swipe derecha ≥ 30% ancho → aprobar (verde)
 * Swipe izquierda ≥ 30% ancho → rechazar (rojo)
 * Tap → navega a detalle
 * Feedback háptico integrado
 *
 * @example
 * ```tsx
 * <TransactionDraftCard
 *   transaction={draft}
 *   onApprove={() => approveDraft(draft.id)}
 *   onReject={() => rejectDraft(draft.id)}
 * />
 * ```
 */

import React, { useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, ArrowDownCircle, ArrowUpCircle, Zap, RefreshCcw, ChevronRight } from "lucide-react";

export interface DraftTransaction {
  id: string;
  merchant: string;
  category: string;
  amount: number;        // positivo = ingreso, negativo = egreso
  date: string;
  time: string;
  confidence: number;    // 0-100
  recurring?: boolean;
}

export interface TransactionDraftCardProps {
  transaction: DraftTransaction;
  onApprove: () => void;
  onReject: () => void;
  onPress?: () => void;    // Tap → detalle
  /** Si la card ya fue procesada (saldrá de la lista) */
  isProcessed?: boolean;
}

const SWIPE_THRESHOLD_RATIO = 0.30; // 30% del ancho

export function TransactionDraftCard({ transaction, onApprove, onReject, onPress, isProcessed }: TransactionDraftCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const isIncome = transaction.amount > 0;

  // Fondos de acción que aparecen al deslizar
  const approveOpacity = useTransform(x, [0, 80], [0, 1]);
  const rejectOpacity = useTransform(x, [-80, 0], [1, 0]);

  // Colores del texto de monto
  const amountColor = isIncome ? "#22C55E" : "#EF4444";

  const confidenceColor =
    transaction.confidence >= 90 ? "#22C55E"
    : transaction.confidence >= 70 ? "#F59E0B"
    : "#EF4444";

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
      const containerWidth = containerRef.current?.offsetWidth ?? 375;
      const threshold = containerWidth * SWIPE_THRESHOLD_RATIO;

      if (info.offset.x > threshold || info.velocity.x > 500) {
        try { navigator.vibrate?.(20); } catch {}
        onApprove();
      } else if (info.offset.x < -threshold || info.velocity.x < -500) {
        try { navigator.vibrate?.(40); } catch {}
        onReject();
      } else {
        x.set(0); // snap back
      }
    },
    [onApprove, onReject, x]
  );

  const formatCOP = (amount: number): string => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat("es-CO", {
      style: "currency", currency: "COP", maximumFractionDigits: 0,
    }).format(abs);
    return amount < 0 ? `-${formatted}` : `+${formatted}`;
  };

  return (
    <AnimatePresence>
      {!isProcessed && (
        <motion.div
          ref={containerRef}
          className="relative overflow-hidden rounded-[14px]"
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/* Fondo rechazar (izquierda) */}
          <motion.div
            className="absolute inset-0 flex items-center justify-end pr-5 bg-danger/10 rounded-[14px]"
            style={{ opacity: rejectOpacity }}
            aria-hidden="true"
          >
            <ThumbsDown size={20} strokeWidth={1.75} className="text-danger" />
          </motion.div>

          {/* Fondo aprobar (derecha) */}
          <motion.div
            className="absolute inset-0 flex items-center justify-start pl-5 bg-success/10 rounded-[14px]"
            style={{ opacity: approveOpacity }}
            aria-hidden="true"
          >
            <ThumbsUp size={20} strokeWidth={1.75} className="text-success" />
          </motion.div>

          {/* Card draggable */}
          <motion.div
            className="relative flex items-center gap-3 p-4 bg-bg-surface border border-border-subtle rounded-[14px] cursor-grab active:cursor-grabbing"
            style={{ x }}
            drag="x"
            dragConstraints={{ left: -200, right: 200 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            whileTap={{ cursor: "grabbing" }}
            onClick={onPress}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onPress?.();
              if (e.key === "ArrowRight") { onApprove(); }
              if (e.key === "ArrowLeft")  { onReject(); }
            }}
            aria-label={`Transacción ${transaction.merchant} ${formatCOP(transaction.amount)}. Flecha derecha para aprobar, flecha izquierda para rechazar.`}
          >
            {/* Icono */}
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isIncome ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}
            >
              {isIncome
                ? <ArrowDownCircle size={20} strokeWidth={1.75} className="text-success" aria-hidden="true" />
                : <ArrowUpCircle size={20} strokeWidth={1.75} className="text-danger" aria-hidden="true" />
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-text-primary text-sm font-semibold leading-tight truncate">
                  {transaction.merchant}
                </p>
                <p className="text-sm font-bold flex-shrink-0 leading-tight" style={{ color: amountColor }}>
                  {formatCOP(transaction.amount)}
                </p>
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-text-tertiary text-xs">{transaction.category}</span>
                <span className="text-border-strong text-xs">·</span>
                <span className="text-text-tertiary text-xs">{transaction.date} {transaction.time}</span>
                {transaction.recurring && (
                  <>
                    <span className="text-border-strong text-xs">·</span>
                    <div className="flex items-center gap-1">
                      <RefreshCcw size={10} strokeWidth={1.75} className="text-warning" aria-hidden="true" />
                      <span className="text-warning text-xs">Recurrente</span>
                    </div>
                  </>
                )}
              </div>

              {/* Confianza IA */}
              <div className="flex items-center gap-1">
                <Zap size={11} strokeWidth={1.75} style={{ color: confidenceColor }} aria-hidden="true" />
                <span className="text-[10px] font-medium" style={{ color: confidenceColor }}>
                  {transaction.confidence}% confianza
                </span>
              </div>
            </div>

            <ChevronRight size={16} strokeWidth={1.75} className="text-border-strong flex-shrink-0" aria-hidden="true" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TransactionDraftCard;
