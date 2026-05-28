/**
 * AppShell — Layout raíz de la PWA mobile
 *
 * Incluye: SafeArea, TopBar, TabBar, slot para contenido.
 * El contenido de la página va en el `children` y se scrollea dentro del área segura.
 *
 * @example
 * ```tsx
 * <AppShell
 *   topBar={{ title: "Proyectos", rightAction: <PlusButton /> }}
 *   activeTab="proyectos"
 * >
 *   <ProyectosList />
 * </AppShell>
 * ```
 */

import React from "react";
import { Mic, FolderKanban, Wallet, BookOpen, User } from "lucide-react";

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

export interface TopBarProps {
  /** Elemento izquierdo: habitualmente ArrowLeft o Avatar */
  leftAction?: React.ReactNode;
  /** Título central. String o nodo */
  title?: React.ReactNode;
  /** Elemento derecho: Plus, Settings, botón guardar, etc. */
  rightAction?: React.ReactNode;
  /** Borde inferior visible. Default: false (se controla desde contenido) */
  border?: boolean;
}

export function TopBar({ leftAction, title, rightAction, border = false }: TopBarProps) {
  return (
    <header
      className={`flex items-center gap-3 px-4 h-14 ${border ? "border-b border-border-subtle" : ""}`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Left */}
      <div className="w-10 flex items-center justify-start flex-shrink-0">
        {leftAction}
      </div>

      {/* Center */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {typeof title === "string" ? (
          <h1 className="text-text-primary text-base font-semibold truncate">{title}</h1>
        ) : (
          title
        )}
      </div>

      {/* Right */}
      <div className="w-10 flex items-center justify-end flex-shrink-0">
        {rightAction}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// TabBar
// ---------------------------------------------------------------------------

const TAB_ITEMS = [
  { id: "home" as const,      icon: Mic,          label: "Hablar",    href: "/m/" },
  { id: "proyectos" as const, icon: FolderKanban, label: "Proyectos", href: "/m/proyectos" },
  { id: "finanzas" as const,  icon: Wallet,       label: "Finanzas",  href: "/m/finanzas" },
  { id: "vault" as const,     icon: BookOpen,     label: "Vault",     href: "/m/vault" },
  { id: "cuenta" as const,    icon: User,         label: "Cuenta",    href: "/m/cuenta" },
] as const;

export type TabId = (typeof TAB_ITEMS)[number]["id"];

export interface TabBarProps {
  activeTab: TabId;
  /** Badges de notificación por tab (número > 0 muestra dot) */
  badges?: Partial<Record<TabId, number>>;
  /** Callback al cambiar de tab (en lugar de navegación href) */
  onTabChange?: (tab: TabId) => void;
}

export function TabBar({ activeTab, badges = {}, onTabChange }: TabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[--z-tab-bar] bg-bg-base/90 border-t border-border-subtle backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around px-2 h-16" role="tablist">
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.id === activeTab;
          const badgeCount = badges[tab.id] ?? 0;

          const handleClick = onTabChange
            ? (e: React.MouseEvent) => { e.preventDefault(); onTabChange(tab.id); }
            : undefined;

          return (
            <a
              key={tab.id}
              href={tab.href}
              onClick={handleClick}
              className={`relative flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center px-3 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                ${isActive ? "text-accent" : "text-text-tertiary hover:text-text-secondary"}`}
              aria-current={isActive ? "page" : undefined}
              role="tab"
              aria-selected={isActive}
            >
              <div className="relative">
                <tab.icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.75}
                  aria-hidden="true"
                />
                {badgeCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center"
                    aria-label={`${badgeCount} pendiente${badgeCount > 1 ? "s" : ""}`}
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// SafeArea (top + bottom padding helper)
// ---------------------------------------------------------------------------

export interface SafeAreaProps {
  children: React.ReactNode;
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function SafeArea({ children, top = false, bottom = false, className = "" }: SafeAreaProps) {
  return (
    <div
      className={className}
      style={{
        paddingTop:    top    ? "env(safe-area-inset-top, 0px)"    : undefined,
        paddingBottom: bottom ? "env(safe-area-inset-bottom, 0px)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppShell — composición principal
// ---------------------------------------------------------------------------

export interface AppShellProps {
  children: React.ReactNode;
  /** Configuración de la TopBar. Si es null, no se renderiza. */
  topBar?: TopBarProps | null;
  /** Tab activo en la TabBar. Si es null, no se renderiza TabBar. */
  activeTab?: TabId | null;
  /** Badges de notificación */
  badges?: Partial<Record<TabId, number>>;
  /** Clase CSS adicional para el contenedor de contenido */
  contentClassName?: string;
}

export function AppShell({
  children,
  topBar,
  activeTab,
  badges,
  contentClassName = "",
}: AppShellProps) {
  const hasTabBar = activeTab !== null && activeTab !== undefined;
  const hasTopBar = topBar !== null && topBar !== undefined;

  return (
    <div className="relative flex flex-col min-h-screen bg-bg-base text-text-primary overflow-hidden">
      {/* TopBar */}
      {hasTopBar && <TopBar {...(topBar as TopBarProps)} />}

      {/* Content */}
      <main
        className={`flex-1 overflow-y-auto ${hasTabBar ? "pb-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom,0px))]" : ""} ${contentClassName}`}
      >
        {children}
      </main>

      {/* TabBar */}
      {hasTabBar && (
        <TabBar
          activeTab={activeTab}
          badges={badges}
        />
      )}
    </div>
  );
}

export default AppShell;
