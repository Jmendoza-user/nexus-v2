/**
 * MicButton — FAB circular con tap/long-press
 *
 * tap:        inicia escucha de voz
 * long-press: cambia a modo texto (muestra input inline)
 * Feedback háptico: navigator.vibrate(20) en tap
 *
 * @example
 * ```tsx
 * <MicButton
 *   state={auraState}
 *   onTap={startListening}
 *   onLongPress={switchToTextMode}
 * />
 * ```
 */

import React, { useCallback, useRef } from "react";
import { Mic, MicOff, Keyboard } from "lucide-react";
import { motion } from "framer-motion";
import type { AuraState } from "./AuraVisualizer";

export interface MicButtonProps {
  state: AuraState;
  onTap: () => void;
  onLongPress?: () => void;
  /** Duración del long-press en ms. Default: 600 */
  longPressDuration?: number;
  disabled?: boolean;
}

const STATE_BG: Record<AuraState, string> = {
  idle:      "from-[#7C5CFF] to-[#5B3ECC]",
  listening: "from-[#34D399] to-[#059669]",
  thinking:  "from-[#FBBF24] to-[#D97706]",
  speaking:  "from-[#3B82F6] to-[#2563EB]",
};

const STATE_SHADOW: Record<AuraState, string> = {
  idle:      "rgba(124,92,255,0.50)",
  listening: "rgba(52,211,153,0.50)",
  thinking:  "rgba(251,191,36,0.50)",
  speaking:  "rgba(59,130,246,0.50)",
};

const STATE_LABEL: Record<AuraState, string> = {
  idle:      "Hablar con el asistente. Mantén presionado para escribir",
  listening: "Escuchando... Toca para detener",
  thinking:  "El asistente está procesando",
  speaking:  "El asistente está respondiendo. Toca para interrumpir",
};

export function MicButton({ state, onTap, onLongPress, longPressDuration = 600, disabled }: MicButtonProps) {
  const pressTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLongPressRef = useRef(false);

  const handlePressStart = useCallback(() => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      try { navigator.vibrate?.(40); } catch {}
      onLongPress?.();
    }, longPressDuration);
  }, [longPressDuration, onLongPress]);

  const handlePressEnd = useCallback(() => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (!isLongPressRef.current) {
      try { navigator.vibrate?.(20); } catch {}
      onTap();
    }
    isLongPressRef.current = false;
  }, [onTap]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  }, [onTap]);

  const isActive = state === "listening" || state === "speaking";
  const isProcessing = state === "thinking";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={() => pressTimerRef.current && clearTimeout(pressTimerRef.current)}
      onKeyDown={handleKeyDown}
      className={`
        relative w-20 h-20 rounded-full flex items-center justify-center
        bg-gradient-to-br ${STATE_BG[state]}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-bg-base
        disabled:opacity-50 disabled:cursor-not-allowed
        select-none touch-none
      `}
      style={{ boxShadow: `0 8px 32px ${STATE_SHADOW[state]}` }}
      aria-label={STATE_LABEL[state]}
      aria-pressed={isActive}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.10, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {/* Anillo pulsante cuando activo */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: "2px solid white" }}
          initial={{ scale: 1, opacity: 0.4 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          aria-hidden="true"
        />
      )}

      {/* Icono */}
      {isProcessing ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        >
          <Keyboard size={28} strokeWidth={1.75} className="text-white opacity-80" />
        </motion.div>
      ) : isActive ? (
        <MicOff size={28} strokeWidth={1.75} className="text-white" aria-hidden="true" />
      ) : (
        <Mic size={28} strokeWidth={1.75} className="text-white" aria-hidden="true" />
      )}
    </motion.button>
  );
}

export default MicButton;
