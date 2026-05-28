/**
 * BottomSheet — Sheet inferior con drag handle y animación framer-motion
 *
 * Comportamiento:
 * - Abre desde abajo con `transform: translateY(0)` desde `translateY(100%)`.
 * - Drag handle visible. Drag down cierra (si `dismissible=true`).
 * - Backdrop con `bg-black/40 backdrop-blur-sm`.
 * - Focus trap: Tab key cicla dentro del sheet.
 * - Esc cierra el sheet.
 *
 * @example
 * ```tsx
 * <BottomSheet
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Nueva nota"
 *   snapPoints={["60vh", "95vh"]}
 * >
 *   <NoteForm />
 * </BottomSheet>
 * ```
 */

import React, { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X } from "lucide-react";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Alturas de snap en vh. Default: ["60vh", "95vh"] */
  snapPoints?: string[];
  /** Si se puede cerrar arrastrando hacia abajo. Default: true */
  dismissible?: boolean;
  /** Mostrar botón X en esquina. Default: false */
  showCloseButton?: boolean;
  children: React.ReactNode;
  /** aria-describedby para el dialog */
  descriptionId?: string;
}

const LONG_TRANSITION = { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] };
const SHORT_TRANSITION = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] };

export function BottomSheet({
  isOpen,
  onClose,
  title,
  dismissible = true,
  showCloseButton = false,
  children,
  descriptionId,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 200], [1, 0.3]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const focusable = sheet.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevenir scroll del body cuando el sheet está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      if (dismissible && info.offset.y > 80) {
        onClose();
      } else {
        y.set(0); // snap back
      }
    },
    [dismissible, onClose, y]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[30] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SHORT_TRANSITION}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            ref={sheetRef}
            className="fixed bottom-0 left-0 right-0 z-[31] bg-bg-surface rounded-t-[20px] border-t border-border-subtle flex flex-col"
            style={{
              y,
              maxHeight: "95vh",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.20)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={LONG_TRANSITION}
            drag={dismissible ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            aria-describedby={descriptionId}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-border-strong" />
            </div>

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-5 py-3">
                {title && (
                  <h2 className="text-text-primary text-base font-semibold">{title}</h2>
                )}
                {showCloseButton && (
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ml-auto"
                    onClick={onClose}
                    aria-label="Cerrar"
                  >
                    <X size={16} strokeWidth={1.75} className="text-text-secondary" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default BottomSheet;
