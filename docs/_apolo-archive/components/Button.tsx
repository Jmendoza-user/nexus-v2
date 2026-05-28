/**
 * Button — 5 variantes × 4 tamaños
 *
 * Variantes: primary | secondary | ghost | destructive | link
 * Tamaños: sm | md | lg | icon
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" onClick={handleApprove}>
 *   Aprobar
 * </Button>
 * <Button variant="destructive" size="md" isLoading>
 *   Eliminando...
 * </Button>
 * <Button variant="ghost" size="icon" aria-label="Cerrar">
 *   <X size={20} />
 * </Button>
 * ```
 */

import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "link";
export type ButtonSize    = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra spinner y deshabilita el botón */
  isLoading?: boolean;
  /** Icono a la izquierda del texto */
  leftIcon?: React.ReactNode;
  /** Icono a la derecha del texto */
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  /** Para type="submit" en forms */
  type?: "button" | "submit" | "reset";
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:     "bg-accent text-white hover:bg-accent-hover active:bg-accent-pressed focus-visible:ring-accent disabled:bg-accent/40 disabled:text-white/60",
  secondary:   "bg-bg-elevated border border-border-strong text-text-primary hover:bg-bg-elevated/80 hover:border-border-strong active:bg-bg-elevated/60 focus-visible:ring-accent disabled:opacity-40",
  ghost:       "bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary active:bg-bg-elevated/80 focus-visible:ring-accent disabled:opacity-40",
  destructive: "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/15 active:bg-danger/20 focus-visible:ring-danger disabled:opacity-40",
  link:        "bg-transparent text-accent hover:text-accent-hover underline-offset-4 hover:underline focus-visible:ring-accent disabled:opacity-40",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm:   "h-8  px-3   text-xs  gap-1.5 rounded-md min-w-[44px]",
  md:   "h-10 px-4   text-sm  gap-2   rounded-md min-w-[44px]",
  lg:   "h-14 px-6   text-sm  gap-2.5 rounded-2xl min-w-[44px]",
  icon: "h-11 w-11   text-sm  gap-0   rounded-full",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-semibold
        transition-all duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base
        active:scale-[0.97]
        select-none cursor-pointer disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `.trim().replace(/\s+/g, " ")}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === "sm" ? 14 : 16} strokeWidth={2} className="animate-spin" aria-hidden="true" />
      ) : leftIcon ? (
        <span aria-hidden="true">{leftIcon}</span>
      ) : null}

      {children && <span>{children}</span>}

      {!isLoading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </button>
  );
}

export default Button;
