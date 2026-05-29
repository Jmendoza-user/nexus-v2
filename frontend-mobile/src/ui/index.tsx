// ============================================================
// NEXUS — Shared UI primitives
// Port verbatim de app/ui.jsx → exports ES + tipos TS (sin cambiar API/clases).
// ============================================================
import { useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../lib/icons';

type Any = any;

function Btn({ variant = 'primary', size = 'md', icon, iconRight, children, full, style, ...p }: Any) {
  return (
    <button className={`btn btn-${variant} btn-${size}${full ? ' btn-block' : ''}`} style={style} {...p}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 20 : 18} />}
    </button>
  );
}

function IconBtn({ name, size = 20, solid, badge, style, ...p }: Any) {
  return (
    <button className={`icon-btn${solid ? ' solid' : ''}`} style={{ position: 'relative', ...style }} {...p}>
      <Icon name={name} size={size} />
      {badge && <span className="badge-dot" />}
    </button>
  );
}

function Chip({ tone, icon, children, style }: Any) {
  return (
    <span className={`chip${tone ? ' ' + tone : ''}`} style={style}>
      {icon && <Icon name={icon} size={13} sw={2} />}
      {children}
    </span>
  );
}

function Avatar({ name = '', size = 40, src, accent, style }: Any) {
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: accent, ...style }}>
      {src ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  );
}

function Bar({ value, tone, height = 6 }: Any) {
  const color = value >= 100 ? 'var(--danger)' : value >= 80 ? 'var(--warning)' : (tone || 'var(--accent)');
  return <div className="bar" style={{ height }}><i style={{ width: Math.min(value, 100) + '%', background: color }} /></div>;
}

function Segmented({ options, value, onChange }: Any) {
  return (
    <div className="seg">
      {options.map((o: Any) => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <button key={val} className={value === val ? 'on' : ''} onClick={() => onChange(val)}>
            {label}
            {typeof o === 'object' && o.badge != null && o.badge > 0 && (
              <span className="count-badge" style={{ minWidth: 18, height: 18 }}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ on, onChange }: Any) {
  return (
    <button className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}><i /></button>
  );
}

function ListRow({ icon, iconBg, iconColor, title, sub, right, rightText, chevron = true, onClick, tone }: Any) {
  return (
    <div className="lrow" onClick={onClick} role="button">
      {icon && (
        <div className="lrow-ic" style={{ background: iconBg, color: iconColor || (tone ? `var(--${tone})` : undefined) }}>
          <Icon name={icon} size={19} />
        </div>
      )}
      <div className="grow col" style={{ gap: 2, minWidth: 0 }}>
        <span className="t-base fw5" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {sub && <span className="t-sm tsec" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </div>
      {right}
      {rightText && <span className="t-sm tsec">{rightText}</span>}
      {chevron && <Icon name="chevron-right" size={18} color="var(--text-tertiary)" />}
    </div>
  );
}

function SearchBar({ placeholder = 'Buscar', value, onChange, onFocus }: Any) {
  return (
    <div className="searchbar">
      <Icon name="search" size={18} color="var(--text-tertiary)" />
      <input value={value} onChange={e => onChange && onChange(e.target.value)} onFocus={onFocus} placeholder={placeholder} />
    </div>
  );
}

function TopBar({ left, title, right, big, sub }: Any) {
  return (
    <div className="topbar">
      <div className="row gap2" style={{ minWidth: 44 }}>{left}</div>
      {!big && <div className="t-base fw6" style={{ flex: 1, textAlign: 'center' }}>{title}</div>}
      <div className="row gap1" style={{ minWidth: 44, justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

function ScreenHeader({ title, sub, action }: Any) {
  return (
    <div className="row between" style={{ padding: '6px 20px 14px', alignItems: 'flex-end' }}>
      <div className="col" style={{ gap: 2 }}>
        <h1 className="t-3xl fw7" style={{ margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
        {sub && <span className="t-sm tsec">{sub}</span>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, body, cta, onCta }: Any) {
  return (
    <div className="empty">
      <div className="ic"><Icon name={icon} size={56} sw={1.25} /></div>
      <div className="col gap2" style={{ alignItems: 'center' }}>
        <h3 className="t-lg fw6" style={{ margin: 0 }}>{title}</h3>
        {body && <p className="t-sm tsec" style={{ margin: 0, maxWidth: 260, textWrap: 'pretty' }}>{body}</p>}
      </div>
      {cta && <Btn size="md" icon="plus" onClick={onCta} style={{ marginTop: 4 }}>{cta}</Btn>}
    </div>
  );
}

// Bottom sheet with mount/unmount animation
function Sheet({ open, onClose, children, title, maxHeight = '88%' }: Any) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))); }
    else { setShow(false); const t = setTimeout(() => setMounted(false), 360); return () => clearTimeout(t); }
  }, [open]);
  if (!mounted) return null;
  return (
    <>
      <div className={`sheet-backdrop${show ? ' show' : ''}`} onClick={onClose} />
      <div className={`sheet${show ? ' show' : ''}`} style={{ maxHeight }} role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        {title && (
          <div className="row between" style={{ padding: '8px 18px 12px' }}>
            <span className="t-lg fw6">{title}</span>
            <IconBtn name="x" size={20} onClick={onClose} />
          </div>
        )}
        <div className="grow" style={{ overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>
      </div>
    </>
  );
}

function Toast({ msg, icon = 'check-circle', tone = 'success', onDone }: Any) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
  return (
    <div className="toast" onClick={onDone}>
      <Icon name={icon} size={20} color={`var(--${tone})`} />
      <span className="t-sm fw5 grow">{msg}</span>
    </div>
  );
}

function QuotaRow({ label, used, total, unit, icon }: Any) {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="col gap2">
      <div className="row between">
        <span className="row gap2 t-sm fw5">{icon && <Icon name={icon} size={15} color="var(--text-secondary)" />}{label}</span>
        <span className="t-xs tsec mono">{used.toLocaleString()} / {total.toLocaleString()} {unit}</span>
      </div>
      <Bar value={pct} height={5} />
    </div>
  );
}

function Skeleton({ w = '100%', h = 14, r = 8, style }: Any) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function StatePill({ state }: Any) {
  const map: Record<string, { c: string; t: string }> = {
    idle: { c: 'var(--text-tertiary)', t: 'Inactivo' },
    running: { c: 'var(--state-listening)', t: 'Ejecutando' },
    paused: { c: 'var(--warning)', t: 'Pausado' },
    error: { c: 'var(--danger)', t: 'Error' },
  };
  const m = map[String(state ?? '').toLowerCase()] || map.idle;
  return (
    <span className="row gap2 t-xs fw6" style={{ color: m.c }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: m.c, boxShadow: `0 0 8px ${m.c}` }} />
      {m.t}
    </span>
  );
}

export type { CSSProperties, ReactNode };
export {
  Btn, IconBtn, Chip, Avatar, Bar, Segmented, Toggle, ListRow, SearchBar,
  TopBar, ScreenHeader, EmptyState, Sheet, Toast, QuotaRow, Skeleton, StatePill,
};
