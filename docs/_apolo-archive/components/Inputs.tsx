/**
 * Inputs — TextField, PasswordField, TextArea, NumberField
 * Toggle, Checkbox, SegmentedControl, Slider
 *
 * @example
 * ```tsx
 * <TextField label="Correo" type="email" placeholder="tu@correo.com" required />
 * <Toggle checked={active} onChange={setActive} label="TokenGuard" />
 * <SegmentedControl
 *   options={[{ value: "resumen", label: "Resumen" }, { value: "inbox", label: "Inbox" }]}
 *   value="inbox"
 *   onChange={setTab}
 * />
 * ```
 */

import React, { useId } from "react";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// TextField base
// ---------------------------------------------------------------------------

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  /** 'sm' = 40px, 'md' = 48px (default), 'lg' = 56px */
  fieldSize?: "sm" | "md" | "lg";
}

const FIELD_SIZE: Record<NonNullable<TextFieldProps["fieldSize"]>, string> = {
  sm: "h-10 text-sm px-3",
  md: "h-12 text-sm px-4",
  lg: "h-14 text-base px-4",
};

export function TextField({
  label,
  hint,
  error,
  leftIcon,
  rightElement,
  fieldSize = "md",
  className = "",
  id: externalId,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-text-primary text-sm font-medium">
          {label}
          {props.required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden="true">
            {leftIcon}
          </div>
        )}

        <input
          id={id}
          className={`
            w-full bg-bg-surface border rounded-sm text-text-primary
            placeholder:text-text-tertiary
            transition-colors duration-100 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${FIELD_SIZE[fieldSize]}
            ${leftIcon ? "pl-10" : ""}
            ${rightElement ? "pr-10" : ""}
            ${error
              ? "border-danger focus:border-danger focus:ring-danger/20"
              : "border-border-strong hover:border-border-strong"
            }
            ${className}
          `.trim().replace(/\s+/g, " ")}
          aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={!!error}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="text-text-tertiary text-xs">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-danger text-xs">
          <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PasswordField
// ---------------------------------------------------------------------------

export function PasswordField(props: Omit<TextFieldProps, "type" | "rightElement">) {
  const [show, setShow] = React.useState(false);

  return (
    <TextField
      {...props}
      type={show ? "text" : "password"}
      rightElement={
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="flex items-center justify-center w-8 h-8 text-text-tertiary hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
        >
          {show ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
        </button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// TextArea
// ---------------------------------------------------------------------------

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  rows?: number;
}

export function TextArea({ label, hint, error, className = "", id: externalId, rows = 4, ...props }: TextAreaProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-text-primary text-sm font-medium">
          {label}
          {props.required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <textarea
        id={id}
        rows={rows}
        className={`
          w-full bg-bg-surface border border-border-strong rounded-sm px-4 py-3 text-sm text-text-primary
          placeholder:text-text-tertiary leading-relaxed resize-y
          focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors
          ${error ? "border-danger focus:border-danger focus:ring-danger/20" : ""}
          ${className}
        `.trim().replace(/\s+/g, " ")}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        {...props}
      />

      {hint && !error && <p id={hintId} className="text-text-tertiary text-xs">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-danger text-xs">
          <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Texto descriptivo debajo del label */
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <label
          htmlFor={id}
          className={`text-sm font-medium cursor-pointer ${disabled ? "text-text-tertiary" : "text-text-primary"}`}
        >
          {label}
        </label>
        {description && (
          <p className="text-text-tertiary text-xs mt-0.5">{description}</p>
        )}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative w-12 h-7 rounded-full transition-colors duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base
          ${checked ? "bg-accent focus-visible:ring-accent" : "bg-border-strong focus-visible:ring-border-strong"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        aria-label={label}
      >
        <div
          className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
            ${checked ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

export function Checkbox({ checked, onChange, label, description, disabled, indeterminate }: CheckboxProps) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          flex-shrink-0 w-5 h-5 rounded-[4px] border-2 flex items-center justify-center
          transition-all duration-[100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base
          ${checked || indeterminate ? "bg-accent border-accent" : "bg-transparent border-border-strong hover:border-text-secondary"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          mt-0.5
        `}
        aria-label={label}
      >
        {checked && !indeterminate && <Check size={12} strokeWidth={3} className="text-white" aria-hidden="true" />}
        {indeterminate && <div className="w-2.5 h-0.5 bg-white rounded-full" aria-hidden="true" />}
      </button>

      <div className="flex-1">
        <label
          htmlFor={id}
          className={`text-sm cursor-pointer ${disabled ? "text-text-tertiary" : "text-text-primary"}`}
        >
          {label}
        </label>
        {description && <p className="text-text-tertiary text-xs mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl
// ---------------------------------------------------------------------------

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex bg-bg-surface rounded-[10px] p-1 border border-border-subtle"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(opt.value)}
            className={`
              relative flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-[8px] transition-colors duration-[100ms]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              ${isSelected ? "bg-accent text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary"}
            `}
          >
            {opt.label}
            {opt.badge != null && opt.badge > 0 && (
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold
                  ${isSelected ? "bg-white/20 text-white" : "bg-warning text-bg-base"}`}
                aria-label={`${opt.badge} items`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  /** Descripción del nivel actual */
  levelDescription?: string;
  showValue?: boolean;
  disabled?: boolean;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  levelDescription,
  showValue = true,
  disabled,
}: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-text-primary text-sm font-medium">{label}</label>
        {showValue && (
          <span className="text-accent text-sm font-bold font-mono">{value}/{max}</span>
        )}
      </div>

      <div className="relative h-8 flex items-center" aria-hidden="true">
        <div className="w-full h-2 bg-bg-elevated rounded-full overflow-visible relative">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${pct}%` }}
          />
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed h-full"
            aria-label={label}
            aria-valuetext={levelDescription}
          />
          {/* Visual thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-accent rounded-full shadow pointer-events-none"
            style={{ left: `calc(${pct}% - 10px)` }}
          />
        </div>
      </div>

      {levelDescription && (
        <p className="text-text-tertiary text-xs leading-relaxed" role="status" aria-live="polite">
          {levelDescription}
        </p>
      )}
    </div>
  );
}
