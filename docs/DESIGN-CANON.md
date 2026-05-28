# DESIGN CANON — NEXUS V2.0

> **Decreto del fundador (28-mayo-2026)**: el sistema visual entregado por el diseñador externo en `designer-external/` es **canónico** y **debe seguirse al pie de la letra**. Cualquier pantalla que se construya en el futuro debe nacer desde este sistema. Ninguna alteración estética sin aprobación explícita de Jerson.

## Fuente de verdad

**Carpeta canónica**: `/root/nexus-v2/docs/designer-external/nexus/`

Contiene:
- `styles/tokens.css` — tokens CSS (paleta dark+light, tipografía, escala 8pt, radii, sombras, easing). Estos son los únicos tokens válidos.
- `styles/components.css` — estilos de componentes (botones, cards, chips, list rows, segmented, inputs, toggle, empty, bottom sheet, toast, tab bar, top bar, swipe card, skeleton, animaciones). Estas son las únicas clases CSS válidas para componentes base.
- `app/ui.jsx` — primitivas React (Btn, IconBtn, Chip, Avatar, Bar, Segmented, Toggle, ListRow, SearchBar, TopBar, ScreenHeader, EmptyState, Sheet, Toast, QuotaRow, Skeleton, StatePill). Estas son las APIs de componente que debemos respetar.
- `app/icons.jsx` — set de iconos Lucide inline (stroke 1.75, currentColor) servidos como `<Icon name="..." />`.
- `app/aura.jsx` — Aura visualizer (canvas con orbital radial + esfera central).
- `app/screen_*.jsx` — 7 archivos de pantallas que son las referencias visuales pixel-perfect:
  - `screen_home.jsx`, `screen_finanzas.jsx`, `screen_proyectos.jsx`, `screen_vault.jsx`, `screen_cuenta.jsx`, `screen_onboarding.jsx`, `screen_misc.jsx` (config, login, agentes, drafts).
- `app/data.js` — mock data con helpers (`NX.fmtCOP`, `NX.drafts`, etc.).
- `Nexus Design System.html`, `Nexus Prototype.html` — entrypoints navegables del prototipo.
- `_shots/*.png` — capturas de referencia visual.

## Logo / Identidad (entregado 28-may-2026)

**Isotipo "N constelación"**: cuatro nodos enlazados por un trazo continuo en zig-zag (forma de N) con un núcleo central — el *nexus* que conecta voz, finanzas y segundo cerebro. Eco directo del Aura del producto.

Assets canónicos en `designer-external/nexus/logo/`:
- `nexus-mark.svg` — isotipo solo (favicon, avatar, app icon). viewBox `0 0 64 64`.
- `nexus-mark-mono.svg` — versión monocromática.
- `nexus-mark-animated.svg` — isotipo con animación (splash/loading).
- `nexus-lockup.svg` — lockup horizontal (isotipo + wordmark "NEXUS"). viewBox `0 0 300 72`.
- `nexus-icon.svg` — ícono para app/PWA.

**Gradiente de marca**: `linearGradient #9B7BFF → #6B4CE6` (violeta claro a violeta oscuro, diagonal). Es el gradiente del logo; el accent plano de UI sigue siendo `#7C5CFF`. Núcleo central con punto blanco (`#fff` en dark, `--bg-base` en light).
**Wordmark**: "NEXUS" en mayúsculas con tracking amplio (`letter-spacing`), Space Grotesk / Inter peso medio.
Referencias visuales: `_shots/logo.png`, `logo2.png`, `logo3.png`, `logo_hero.png`, `logo_anim.png`. Documento navegable: `Nexus Logo.html`.

**Uso PWA**: `nexus-mark.svg` como base de los iconos `manifest.json` (exportar PNG 192/512 con fondo `--bg-base`). Favicon desde `nexus-icon.svg`.

## Sistema visual — resumen

- **Paleta dark default**: bg `#07070A`/`#101015`/`#1A1A22`, text `#F4F4F7`/`#A8A8B8`/`#6A6A7C`, accent **`#7C5CFF`** (violeta).
- **Light mirror**: bg `#FAFAFB`/`#FFFFFF`/`#F1F1F5`, mismo accent.
- **Tipografía**: Inter (sans), Space Grotesk (display: titulares grandes, montos), JetBrains Mono (debug). Escala `t-xs` a `t-4xl` por CSS vars.
- **Grid**: 8pt (`--s1=4px` a `--s16=64px`).
- **Radii**: `--r-sm=6` `--r-md=10` `--r-lg=14` `--r-xl=20` `--r-2xl=28`.
- **Easing universal**: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Iconografía**: Lucide stroke 1.75 con `currentColor`. Tamaño base 20px.
- **Cero emojis** en UI cromática (solo iconos Lucide).
- **Topbar y Tabbar** con `backdrop-filter: blur(16-18px)` sobre `bg-base` translúcido — efecto vidrio característico.

## Estilo de implementación

- **Stack productivo**: React 19 + TypeScript + Vite + **Vanilla CSS** (NO Tailwind v4). Importamos `tokens.css` + `components.css` como base, escribimos clases utility en línea donde haga falta (`row`, `col`, `gap2`, `t-base`, `fw6`, etc. ya están provistas).
- **API de componentes**: respetar nombres y props del `ui.jsx` original (Btn, IconBtn, Chip, ListRow, Sheet, Toast, Segmented, Toggle, etc.). Migrar de `Object.assign(window, {...})` a exports ES modules.
- **TypeScript**: añadir tipos sin cambiar la API visual. Props existentes se tipan, no se renombran.
- **Iconos**: usar `lucide-react` con prop `strokeWidth={1.75}` y `color="currentColor"` para mantener consistencia con el set custom del diseñador. Si un icono no existe en Lucide, se importa del `icons.jsx` original como SVG inline.
- **Animaciones**: replicar exactas las definidas en `components.css` (`screenIn`, `fadeUp`, `shimmer`, `toastIn`). Para interacciones complejas (swipe cards, sheets con drag) usar el código del diseñador como referencia, no framer-motion al inicio.
- **Layout**: la app vive dentro de un contenedor mobile-first (max-width ~480px en desktop, simulación iOS frame para preview). Las pantallas son `<div className="col">` con `topbar` sticky + contenido scrollable + tabbar absoluto inferior.

## Lo que se descarta de APOLO

Movido a `_apolo-archive/`:
- `_apolo-archive/mockups/` (16 mockups Tailwind) — reemplazados por `designer-external/nexus/app/screen_*.jsx`.
- `_apolo-archive/components/` (10 archivos de componentes Tailwind) — reemplazados por `designer-external/nexus/app/ui.jsx` + `components.css`.
- `_apolo-archive/design-system.md` (tokens en formato Tailwind v4 `@theme`) — reemplazado por `designer-external/nexus/styles/tokens.css` + esta nota.

**No borrar** el archivo. Puede ser consulta histórica y los componentes domain-specific de APOLO (DomainCards, TransactionDraftCard, OAuthConnectButton) pueden inspirar variantes futuras si Jerson aprueba.

## Lo que se conserva de APOLO (no conflictúa)

- `aura-spec.md` — especificación técnica del Aura. El diseñador externo entregó una implementación visual (`aura.jsx`) más simple (orbital radial + esfera). **Acción**: validar que la spec de APOLO sea compatible con la implementación del diseñador externo. Si diverge, **gana el diseñador externo**.
- `brand-manual.md` — manual de marca (3 conceptos de logo, esencia, tono). Sigue siendo válido hasta que Jerson valide el logo final.
- `prototype-flows.md` — flujos prototipados (onboarding 8 pasos, aprobar borradores). Compatible con cualquier sistema visual. Se mantiene como referencia narrativa.
- `illustrations/` — 8 ilustraciones SVG line-art `currentColor`. Compatibles con el sistema canónico. Se mantienen.
- `design-brief.md` — el brief original que Jerson aprobó. Sigue siendo el contrato funcional (qué pantallas, qué patrones, qué microcopy). El **cómo** lo dicta ahora el diseñador externo.

## Plan de adopción técnica (para Hito 0)

1. **Estructura**: crear `/root/nexus-v2/frontend-mobile/` con Vite + React 19 + TS.
2. **Bootstrap visual**: importar `tokens.css` y `components.css` del diseñador en `frontend-mobile/src/styles/`. Estos archivos NO se modifican salvo correcciones bug.
3. **Componentes base**: portar `ui.jsx` a `frontend-mobile/src/ui/` archivo por archivo (`Button.tsx`, `Chip.tsx`, etc.), añadiendo tipos sin cambiar API. Cada componente conserva su clase CSS (`.btn`, `.chip`, etc.) y comportamiento.
4. **Aura**: portar `aura.jsx` a `frontend-mobile/src/components/AuraVisualizer.tsx` manteniendo el algoritmo visual exacto. Documentar parámetros en JSDoc.
5. **Iconos**: instalar `lucide-react`. Crear wrapper `<Icon name="..." />` que mappee a Lucide manteniendo la API del diseñador (mismo prop signature, mismo size default 20, mismo strokeWidth 1.75).
6. **Pantallas**: portar cada `screen_*.jsx` a `frontend-mobile/src/screens/*.tsx` reemplazando `Object.assign(window, ...)` por exports ES y `React.useState` por imports. **El JSX renderizado debe ser idéntico al prototipo**.
7. **Data layer**: reemplazar `NX.*` mock data por hooks que consumen el backend real (`useDrafts()`, `useFinanceSummary()`, etc.). Los componentes no cambian.
8. **Validación**: capturas pixel-perfect comparadas contra `_shots/*.png` del diseñador. Cualquier diferencia es bug, no licencia creativa.

## Reglas para el equipo (CLAUDE/HEFESTO/cualquier agente futuro)

1. ❌ **Prohibido** introducir Tailwind CSS en `frontend-mobile/`.
2. ❌ **Prohibido** instalar shadcn/ui, Radix UI, MUI, Chakra, o cualquier librería de componentes.
3. ❌ **Prohibido** alterar valores en `tokens.css` o `components.css` sin aprobación de Jerson.
4. ❌ **Prohibido** renombrar las clases CSS del diseñador (`.btn`, `.chip`, `.lrow`, `.sheet`, etc.).
5. ✅ **Obligatorio** usar las primitivas de `ui.jsx` portadas (Btn, IconBtn, Chip, ListRow, Sheet, etc.) antes de crear componentes nuevos.
6. ✅ **Obligatorio** comparar visualmente cualquier nueva pantalla contra el estilo del prototipo (`Nexus Prototype.html`) antes de mergear.
7. ✅ Si una pantalla NUEVA (no listada en el brief) requiere componentes nuevos, primero proponer mockup que herede el lenguaje del diseñador (radii, colores, espaciado, jerarquía) y pedir aprobación a Jerson.

## Referencia rápida — comparar antes de implementar

| Necesito... | Uso esto del diseñador |
|-------------|------------------------|
| Un botón | `Btn` con variants `primary|secondary|ghost|destructive|success` y sizes `sm|md|lg` |
| Un icono | `<Icon name="..." size={20} />` (Lucide via wrapper) |
| Un tag/badge | `Chip` con tone `accent|success|warning|danger|info` |
| Una card | `.card` + `.card-pad` (CSS) o `.card.elevated` |
| Lista de items | `ListRow` con `icon`, `title`, `sub`, `right`, `chevron` |
| Selector de tabs | `Segmented` con array de options (opcional badge en cada uno) |
| Toggle on/off | `Toggle` con `on` + `onChange` |
| Bottom sheet modal | `Sheet` con `open`, `onClose`, `title` |
| Toast notificación | `Toast` con `msg`, `icon`, `tone`, `onDone` |
| Top bar de pantalla | `TopBar` con `left`, `title`, `right` |
| Header con título grande | `ScreenHeader` con `title`, `sub`, `action` |
| Empty state | `EmptyState` con `icon`, `title`, `body`, `cta`, `onCta` |
| Avatar circular | `Avatar` con `name`, `size`, opcional `src` |
| Barra de progreso | `Bar` con `value` (0-100), opcional `tone` |
| Quota visual | `QuotaRow` con `label`, `used`, `total`, `unit`, opcional `icon` |
| Skeleton loader | `Skeleton` con `w`, `h`, `r` |
| Estado de agente | `StatePill` con `state` `idle|Running|Paused` |

Todo lo demás (formularios complejos, gráficos, editores) se compone de estas primitivas + utilidades CSS (`row`, `col`, `gap2`, `t-base`, `fw6`, `tsec`, etc.).
