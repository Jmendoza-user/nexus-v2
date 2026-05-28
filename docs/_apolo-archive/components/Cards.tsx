/**
 * Cards — Card, ListItem, Chip, Badge, Avatar
 *
 * @example
 * ```tsx
 * <Card variant="elevated" onClick={handlePress} aria-label="Proyecto Amparo">
 *   <p>Contenido</p>
 * </Card>
 * <Badge variant="warning">3 pendientes</Badge>
 * <Avatar name="Jerson Mendoza" size="md" />
 * <Chip label="nexus" icon={<Hash size={12} />} onRemove={() => {}} />
 * ```
 */

import React from "react";
import { X } from "lucide-react";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type CardVariant = "default" | "elevated" | "interactive" | "selected";

export interface CardProps {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** Para cards con navegación (renderiza como <a>) */
  href?: string;
  "aria-label"?: string;
}

const CARD_VARIANT: Record<CardVariant, string> = {
  default:     "bg-bg-surface border border-border-subtle",
  elevated:    "bg-bg-elevated border border-border-subtle",
  interactive: "bg-bg-surface border border-border-subtle hover:border-border-strong hover:bg-bg-elevated cursor-pointer active:scale-[0.98]",
  selected:    "bg-bg-surface border border-accent ring-1 ring-accent/20",
};

export function Card({ variant = "default", children, className = "", onClick, href, "aria-label": ariaLabel }: CardProps) {
  const base = `rounded-lg p-4 transition-all duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base`;
  const classes = `${base} ${CARD_VARIANT[variant]} ${className}`;

  if (href) {
    return <a href={href} className={classes} aria-label={ariaLabel}>{children}</a>;
  }
  if (onClick) {
    return <div onClick={onClick} className={classes} role="button" tabIndex={0} aria-label={ariaLabel} onKeyDown={(e) => e.key === "Enter" && onClick()}>{children}</div>;
  }
  return <div className={classes} aria-label={ariaLabel}>{children}</div>;
}

// ---------------------------------------------------------------------------
// ListItem
// ---------------------------------------------------------------------------

export interface ListItemProps {
  /** Icono o avatar a la izquierda */
  leading?: React.ReactNode;
  /** Elemento a la derecha: chevron, badge, toggle */
  trailing?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function ListItem({ leading, trailing, title, subtitle, onClick, href, disabled, "aria-label": ariaLabel }: ListItemProps) {
  const content = (
    <>
      {leading && <div className="flex-shrink-0 w-10 flex items-center justify-center">{leading}</div>}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug truncate ${disabled ? "text-text-tertiary" : "text-text-primary"}`}>{title}</p>
        {subtitle && <p className="text-xs text-text-tertiary mt-0.5 truncate">{subtitle}</p>}
      </div>
      {trailing && <div className="flex-shrink-0 flex items-center">{trailing}</div>}
    </>
  );

  const classes = `flex items-center gap-3 px-4 py-3.5 w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset
    ${!disabled && (onClick || href) ? "hover:bg-bg-elevated cursor-pointer" : ""}
    ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;

  if (href && !disabled) {
    return <a href={href} className={classes} aria-label={ariaLabel}>{content}</a>;
  }
  if (onClick && !disabled) {
    return <button type="button" onClick={onClick} className={classes} aria-label={ariaLabel}>{content}</button>;
  }
  return <div className={classes} aria-label={ariaLabel}>{content}</div>;
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

export interface ChipProps {
  label: string;
  /** Icono a la izquierda del texto */
  icon?: React.ReactNode;
  /** Si se puede eliminar, muestra una X */
  onRemove?: () => void;
  /** Si es seleccionable */
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: "default" | "accent" | "success" | "warning" | "danger" | "info";
}

const CHIP_VARIANTS: Record<NonNullable<ChipProps["variant"]>, string> = {
  default: "bg-bg-elevated border border-border-strong text-text-secondary hover:border-border-strong",
  accent:  "bg-accent/10 border border-accent/30 text-accent",
  success: "bg-success/10 border border-success/30 text-success",
  warning: "bg-warning/10 border border-warning/30 text-warning",
  danger:  "bg-danger/10  border border-danger/30  text-danger",
  info:    "bg-info/10    border border-info/30    text-info",
};

export function Chip({ label, icon, onRemove, onClick, selected, disabled, variant = "default" }: ChipProps) {
  const variantClass = selected
    ? CHIP_VARIANTS.accent
    : CHIP_VARIANTS[variant];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all
        ${variantClass}
        ${onClick ? "cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" : ""}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={onClick && !disabled ? onClick : undefined}
      onKeyDown={onClick && !disabled ? (e) => e.key === "Enter" && onClick() : undefined}
      aria-pressed={onClick ? selected : undefined}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{label}</span>
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
          aria-label={`Eliminar etiqueta ${label}`}
        >
          <X size={10} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "info" | "pro";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  /** Dot indicator instead of text */
  dot?: boolean;
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-bg-elevated text-text-secondary",
  accent:  "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger:  "bg-danger/10 text-danger",
  info:    "bg-info/10 text-info",
  pro:     "bg-accent text-white",
};

export function Badge({ children, variant = "default", dot }: BadgeProps) {
  if (dot) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${BADGE_VARIANTS[variant]}`}
        role="status"
        aria-label={typeof children === "string" ? children : undefined}
      />
    );
  }

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold ${BADGE_VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  /** Nombre para generar iniciales si no hay src */
  name: string;
  /** URL de imagen */
  src?: string;
  size?: AvatarSize;
  /** Badge de estado en esquina inferior derecha */
  statusBadge?: "online" | "busy" | "away";
}

const AVATAR_SIZES: Record<AvatarSize, { container: string; text: string; badge: string }> = {
  xs: { container: "w-6 h-6",   text: "text-[10px]", badge: "w-2 h-2" },
  sm: { container: "w-8 h-8",   text: "text-xs",     badge: "w-2 h-2" },
  md: { container: "w-10 h-10", text: "text-sm",     badge: "w-2.5 h-2.5" },
  lg: { container: "w-14 h-14", text: "text-base",   badge: "w-3 h-3" },
  xl: { container: "w-20 h-20", text: "text-xl",     badge: "w-4 h-4" },
};

const STATUS_COLORS: Record<NonNullable<AvatarProps["statusBadge"]>, string> = {
  online: "bg-success",
  busy:   "bg-danger",
  away:   "bg-warning",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ name, src, size = "md", statusBadge }: AvatarProps) {
  const { container, text, badge } = AVATAR_SIZES[size];
  const initials = getInitials(name);

  return (
    <div className={`relative flex-shrink-0 ${container}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${container} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${container} rounded-full bg-gradient-to-br from-accent to-[#5B3ECC] flex items-center justify-center text-white font-semibold select-none`}
          aria-label={name}
        >
          <span className={text}>{initials}</span>
        </div>
      )}

      {statusBadge && (
        <div
          className={`absolute bottom-0 right-0 ${badge} rounded-full ${STATUS_COLORS[statusBadge]} border-2 border-bg-base`}
          role="status"
          aria-label={statusBadge}
        />
      )}
    </div>
  );
}
