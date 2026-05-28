/**
 * Feedback — Toast, Banner, Skeleton, EmptyState
 *
 * @example
 * ```tsx
 * <Toast message="Borrador aprobado" variant="success" onDismiss={() => {}} />
 * <Banner variant="warning" message="Llevas 80% de tu quota mensual" />
 * <Skeleton width="100%" height={20} rounded="lg" />
 * <EmptyState
 *   icon={<Wallet size={48} strokeWidth={1} />}
 *   title="Sin transacciones"
 *   description="El agente aún no ha detectado borradores en tu Gmail."
 *   cta={{ label: "Conectar Gmail", onClick: handleConnect }}
 * />
 * ```
 */

import React, { useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, WifiOff, Lock } from "lucide-react";

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export type ToastVariant = "success" | "error" | "warning" | "info" | "default";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  /** Tiempo en ms antes de auto-dismiss. Default: 3000. 0 = no auto-dismiss */
  duration?: number;
  /** Acción inline opcional */
  action?: { label: string; onClick: () => void };
}

const TOAST_ICON: Record<ToastVariant, React.ComponentType<any> | null> = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
  default: null,
};

const TOAST_COLOR: Record<ToastVariant, string> = {
  success: "text-success",
  error:   "text-danger",
  warning: "text-warning",
  info:    "text-info",
  default: "text-text-secondary",
};

export function Toast({ message, variant = "default", onDismiss, duration = 3000, action }: ToastProps) {
  const Icon = TOAST_ICON[variant];

  useEffect(() => {
    if (!duration || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 bg-bg-elevated border border-border-strong rounded-[14px] px-4 py-3.5 shadow-elevated max-w-sm w-full"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.30)" }}
    >
      {Icon && (
        <Icon size={18} strokeWidth={1.75} className={`flex-shrink-0 ${TOAST_COLOR[variant]}`} aria-hidden="true" />
      )}
      <p className="flex-1 text-text-primary text-sm font-medium">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex-shrink-0 text-accent text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Cerrar notificación"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

/**
 * ToastContainer — posiciona los toasts sobre el tab-bar
 * Uso: renderizar en el root del AppShell
 */
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom,0px)+12px)] left-1/2 -translate-x-1/2 z-[40] flex flex-col gap-2 items-center w-full px-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="pointer-events-auto flex flex-col gap-2 items-center w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export type BannerVariant = "warning" | "danger" | "info" | "offline" | "quota";

export interface BannerProps {
  variant: BannerVariant;
  message: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  onDismiss?: () => void;
}

const BANNER_CONFIG: Record<BannerVariant, { icon: React.ComponentType<any>; bg: string; color: string; border: string }> = {
  warning:  { icon: AlertTriangle, bg: "bg-warning/10",     color: "text-warning",  border: "border-warning/30" },
  danger:   { icon: AlertCircle,   bg: "bg-danger/10",      color: "text-danger",   border: "border-danger/30" },
  info:     { icon: Info,          bg: "bg-info/10",        color: "text-info",     border: "border-info/30" },
  offline:  { icon: WifiOff,       bg: "bg-bg-elevated",    color: "text-text-secondary", border: "border-border-subtle" },
  quota:    { icon: Lock,          bg: "bg-danger/10",      color: "text-danger",   border: "border-danger/30" },
};

export function Banner({ variant, message, cta, onDismiss }: BannerProps) {
  const { icon: Icon, bg, color, border } = BANNER_CONFIG[variant];

  return (
    <div
      role="banner"
      className={`flex items-center gap-3 px-4 py-3 border-b ${bg} ${border}`}
    >
      <Icon size={16} strokeWidth={1.75} className={`flex-shrink-0 ${color}`} aria-hidden="true" />
      <p className={`flex-1 text-xs font-medium ${color}`}>{message}</p>
      {cta && (
        cta.href ? (
          <a href={cta.href} className={`flex-shrink-0 text-xs font-semibold underline ${color} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded`}>
            {cta.label}
          </a>
        ) : (
          <button onClick={cta.onClick} className={`flex-shrink-0 text-xs font-semibold underline ${color} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded`}>
            {cta.label}
          </button>
        )
      )}
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary" aria-label="Cerrar aviso">
          <X size={12} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
  className?: string;
}

const SKELETON_RADIUS: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm:   "rounded-sm",
  md:   "rounded-md",
  lg:   "rounded-lg",
  full: "rounded-full",
};

export function Skeleton({ width = "100%", height = 16, rounded = "md", className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer ${SKELETON_RADIUS[rounded]} ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Cargando..."
    />
  );
}

/** Skeleton para una ListItem */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <Skeleton width={40} height={40} rounded="lg" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton height={14} rounded="sm" width="60%" />
        <Skeleton height={12} rounded="sm" width="40%" />
      </div>
    </div>
  );
}

/** Skeleton para una Card */
export function SkeletonCard() {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
      <Skeleton height={16} rounded="sm" width="75%" />
      <Skeleton height={12} rounded="sm" />
      <Skeleton height={12} rounded="sm" width="85%" />
      <div className="flex gap-2 mt-1">
        <Skeleton height={24} rounded="md" width={80} />
        <Skeleton height={24} rounded="md" width={60} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  cta?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center" role="status" aria-label={title}>
      <div className="text-border-strong mb-6" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-text-primary text-xl font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-text-tertiary text-sm leading-relaxed mb-8 max-w-xs">{description}</p>
      )}
      {cta && (
        cta.href ? (
          <a
            href={cta.href}
            className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-2xl font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
            style={{ boxShadow: "0 8px 24px rgba(124,92,255,0.30)" }}
          >
            {cta.label}
          </a>
        ) : (
          <button
            onClick={cta.onClick}
            className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-2xl font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
            style={{ boxShadow: "0 8px 24px rgba(124,92,255,0.30)" }}
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  );
}
