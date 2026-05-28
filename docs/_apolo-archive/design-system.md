# Design System — NEXUS V2.0

> Sistema de diseño listo para implementar. Cada token, componente y regla es copy-paste-ready para React 19 + Tailwind CSS v4.

---

## 1. Tokens CSS — Variables raíz

### Modo oscuro (default)

```css
:root,
[data-theme="dark"] {
  /* Fondos */
  --bg-base:         #07070A;
  --bg-surface:      #101015;
  --bg-elevated:     #1A1A22;

  /* Bordes */
  --border-subtle:   #1F1F29;
  --border-strong:   #2A2A36;

  /* Texto */
  --text-primary:    #F4F4F7;
  --text-secondary:  #A8A8B8;
  --text-tertiary:   #6A6A7C;

  /* Marca */
  --accent:          #7C5CFF;
  --accent-soft:     rgba(124, 92, 255, 0.10);
  --accent-hover:    #9175FF;
  --accent-pressed:  #6344F0;

  /* Estados conversacionales (Aura) */
  --state-idle:      #7C5CFF;
  --state-listening: #34D399;
  --state-thinking:  #FBBF24;
  --state-speaking:  #3B82F6;

  /* Semánticos */
  --success:         #22C55E;
  --success-soft:    rgba(34, 197, 94, 0.10);
  --warning:         #F59E0B;
  --warning-soft:    rgba(245, 158, 11, 0.10);
  --danger:          #EF4444;
  --danger-soft:     rgba(239, 68, 68, 0.10);
  --info:            #60A5FA;
  --info-soft:       rgba(96, 165, 250, 0.10);

  /* Elevación (sin sombras en dark) */
  --elevation-1:     var(--bg-surface);
  --elevation-2:     var(--bg-elevated);

  /* Focus ring */
  --focus-ring:      0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent);

  /* Overlay */
  --overlay:         rgba(0, 0, 0, 0.60);
  --overlay-blur:    backdrop-filter: blur(8px);

  /* Tipografía */
  --font-sans:       'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif;
  --font-display:    'Space Grotesk', var(--font-sans);
  --font-mono:       'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  /* Motion */
  --ease-ui:         cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-micro:       100ms;
  --dur-short:       180ms;
  --dur-medium:      280ms;
  --dur-long:        450ms;

  /* Radii */
  --radius-sm:       6px;
  --radius-md:       10px;
  --radius-lg:       14px;
  --radius-xl:       20px;
  --radius-2xl:      28px;
  --radius-full:     9999px;

  /* Safe areas */
  --safe-top:        env(safe-area-inset-top, 0px);
  --safe-bottom:     env(safe-area-inset-bottom, 0px);
  --tab-bar-height:  64px;
  --top-bar-height:  56px;
}
```

### Modo claro

```css
[data-theme="light"] {
  --bg-base:         #FAFAFB;
  --bg-surface:      #FFFFFF;
  --bg-elevated:     #F2F2F7;

  --border-subtle:   #E5E5EA;
  --border-strong:   #D1D1DB;

  --text-primary:    #0A0A12;
  --text-secondary:  #4A4A5C;
  --text-tertiary:   #9A9AAC;

  /* accent se mantiene idéntico en ambos modos */
  --accent:          #7C5CFF;
  --accent-soft:     rgba(124, 92, 255, 0.08);
  --accent-hover:    #9175FF;
  --accent-pressed:  #6344F0;

  --state-idle:      #7C5CFF;
  --state-listening: #16A34A;
  --state-thinking:  #D97706;
  --state-speaking:  #2563EB;

  --success:         #16A34A;
  --success-soft:    rgba(22, 163, 74, 0.08);
  --warning:         #D97706;
  --warning-soft:    rgba(217, 119, 6, 0.08);
  --danger:          #DC2626;
  --danger-soft:     rgba(220, 38, 38, 0.08);
  --info:            #2563EB;
  --info-soft:       rgba(37, 99, 235, 0.08);

  --elevation-1:     var(--bg-surface);
  --elevation-2:     var(--bg-elevated);

  /* Sombras activas solo en light mode */
  --shadow-card:     0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-elevated: 0 12px 32px rgba(124,92,255,0.18), 0 4px 8px rgba(0,0,0,0.06);
  --shadow-sheet:    0 -4px 24px rgba(0,0,0,0.10);

  --overlay:         rgba(0, 0, 0, 0.40);
}
```

---

## 2. Configuración Tailwind v4 con `@theme`

Copiar en `src/styles/global.css` (entry point de Tailwind v4):

```css
@import "tailwindcss";

@theme {
  /* === COLORES === */
  --color-bg-base:       var(--bg-base);
  --color-bg-surface:    var(--bg-surface);
  --color-bg-elevated:   var(--bg-elevated);

  --color-border-subtle: var(--border-subtle);
  --color-border-strong: var(--border-strong);

  --color-text-primary:   var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary:  var(--text-tertiary);

  --color-accent:         var(--accent);
  --color-accent-soft:    var(--accent-soft);
  --color-accent-hover:   var(--accent-hover);

  --color-listening:      var(--state-listening);
  --color-thinking:       var(--state-thinking);
  --color-speaking:       var(--state-speaking);

  --color-success:        var(--success);
  --color-success-soft:   var(--success-soft);
  --color-warning:        var(--warning);
  --color-warning-soft:   var(--warning-soft);
  --color-danger:         var(--danger);
  --color-danger-soft:    var(--danger-soft);
  --color-info:           var(--info);
  --color-info-soft:      var(--info-soft);

  /* === TIPOGRAFÍA === */
  --font-sans:    var(--font-sans);
  --font-display: var(--font-display);
  --font-mono:    var(--font-mono);

  /* === RADII === */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;
  --radius-2xl:  28px;

  /* === ESPACIADO (override de la escala 8pt) === */
  --spacing-1:  4px;
  --spacing-2:  8px;
  --spacing-3:  12px;
  --spacing-4:  16px;
  --spacing-5:  20px;
  --spacing-6:  24px;
  --spacing-8:  32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;

  /* === ANIMACIONES === */
  --ease-ui:    cubic-bezier(0.2, 0.8, 0.2, 1);
  --duration-micro:  100ms;
  --duration-short:  180ms;
  --duration-medium: 280ms;
  --duration-long:   450ms;

  /* === LAYOUT === */
  --tab-bar-height:  64px;
  --top-bar-height:  56px;
}

/* Animaciones keyframe custom */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

@keyframes pulse-ring {
  0%   { transform: scale(0.95); opacity: 0.8; }
  70%  { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(0.95); opacity: 0; }
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Utilidades custom */
.animate-shimmer {
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 25%,
    var(--bg-surface) 50%,
    var(--bg-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.focus-ring:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.safe-bottom { padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 16px); }
.safe-top    { padding-top: calc(var(--top-bar-height) + var(--safe-top)); }
```

---

## 3. Catálogo tipográfico

### Jerarquía visual

```
text-4xl  —  2.25rem / 36px / lh 1.15  —  Space Grotesk 700
             USO: Montos balance, display hero onboarding
             EJEMPLO: "$2.430.500"

text-3xl  —  1.875rem / 30px / lh 1.2   —  Space Grotesk 700 o Inter 700
             USO: Títulos hero onboarding, empty state headline
             EJEMPLO: "Tu asistente personal"

text-2xl  —  1.5rem / 24px / lh 1.3     —  Inter 600
             USO: Título de pantalla en top-bar, encabezado de sección principal
             EJEMPLO: "Proyectos"

text-xl   —  1.25rem / 20px / lh 1.4    —  Inter 600
             USO: Nombre de proyecto, título de card, título de nota vault
             EJEMPLO: "Rediseño landing Amparo"

text-lg   —  1.125rem / 18px / lh 1.5   —  Inter 500
             USO: Lead de transacción, monto secundario, subtítulo de sección
             EJEMPLO: "Mercado Libre — $185.000"

text-base —  1rem / 16px / lh 1.55      —  Inter 400
             USO: Cuerpo de notificación, descripción de skill, texto de nota
             EJEMPLO: "El agente detectó un cargo recurrente por Netflix."

text-sm   —  0.875rem / 14px / lh 1.5   —  Inter 400 / 500
             USO: Metadatos, hints, subtexto de list item, label de input
             EJEMPLO: "Hace 2 horas · Spotify"

text-xs   —  0.75rem / 12px / lh 1.4    —  Inter 500 (siempre medium weight)
             USO: Badges, etiquetas de chip, contadores, label de tab-bar
             EJEMPLO: "PRO" "3 pendientes"

font-mono —  JetBrains Mono 400
             USO: IDs de transacción, tokens de API, snippets de código
             EJEMPLO: "txn_2026_0528_001"
```

### Reglas tipográficas

1. Nunca usar `font-light` (300) — demasiado delgado en pantallas AMOLED.
2. `font-bold` (700) reservado para montos, CTAs principales, y display.
3. `text-tertiary` solo para placeholders y texto claramente secundario — nunca para información que el usuario necesita leer.
4. Máximo 2 tamaños diferentes en una misma tarjeta.
5. `font-mono` solo para datos que se copian/pegan (IDs, keys, códigos).

---

## 4. Escala de espaciado (8pt grid)

```
Unidad visual del sistema: 4px (half-unit)

1   →  4px  ── (micro-gap: entre icono y texto en badge)
              [■] gap

2   →  8px  ── (gap interno: entre elementos de un chip)
              [■■]

3   →  12px ── (padding xs: dentro de un chip, badge padding vertical)
              [■■■]

4   →  16px ── (padding estándar: padding horizontal de list item, gap entre cards)
              [■■■■]

5   →  20px ── (padding md: padding de card, espacio entre secciones menores)
              [■■■■■]

6   →  24px ── (padding lg: padding de pantalla full-width, espacio de sección)
              [■■■■■■]

8   →  32px ── (espacio entre secciones: separación visual de grupos)
              [■■■■■■■■]

10  →  40px ── (elemento grande: altura de input, altura de list item compacto)
              [■■■■■■■■■■]

12  →  48px ── (elemento xl: altura de top-bar, altura de tab-bar, botón lg)
              [■■■■■■■■■■■■]

16  →  64px ── (espacio hero: margen vertical en onboarding, altura tab-bar total)
              [■■■■■■■■■■■■■■■■]

Regla de thumb-zone (375px wide):
  ████████████████████████  Fácil alcance pulgar   (y > 280px desde top)
  ████████████████████████
  ░░░░░░░░░░░░░░░░░░░░░░░░  Alcance con esfuerzo   (y 180–280px)
  ░░░░░░░░░░░░░░░░░░░░░░░░
  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  Difícil (solo lectura)  (y < 180px)

  → Acciones primarias (mic, aprobar, crear): zona fácil y media
  → Información densa (stats, balances): zona difícil ok
```

---

## 5. Especificación de radii, sombras y transiciones

### Radii — cuándo usar cada uno

| Token | px | Aplica a |
|-------|----|----------|
| `rounded-sm` | 6px | Inputs, selects, chips compactos, code blocks |
| `rounded-md` | 10px | Botones (sm, md), badges de estado, tag chips |
| `rounded-lg` | 14px | Cards principales, list items con elevación, mini sheets |
| `rounded-xl` | 20px | Bottom sheets (top corners), modales, drawers |
| `rounded-2xl` | 28px | FAB mic, botón CTA hero |
| `rounded-full` | 9999px | Avatares, toggle pills, contadores circulares |

### Sombras

En **dark mode**: elevar con `bg-elevated` + borde `border-subtle`. NO usar box-shadow.

En **light mode**:
```css
/* Card estándar */
box-shadow: var(--shadow-card);
/* = 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04) */

/* Sheet / Modal elevado */
box-shadow: var(--shadow-elevated);
/* = 0 12px 32px rgba(124,92,255,0.18), 0 4px 8px rgba(0,0,0,0.06) */

/* Bottom sheet */
box-shadow: var(--shadow-sheet);
/* = 0 -4px 24px rgba(0,0,0,0.10) */
```

### Transiciones estándar

```css
/* Micro: hover states, color changes */
transition: color var(--dur-micro) var(--ease-ui),
            background-color var(--dur-micro) var(--ease-ui),
            border-color var(--dur-micro) var(--ease-ui);

/* Short: botones, chips, badges (scale + color) */
transition: all var(--dur-short) var(--ease-ui);

/* Medium: apertura de sheets, modales, expansion */
transition: transform var(--dur-medium) var(--ease-ui),
            opacity var(--dur-medium) var(--ease-ui);

/* Long: sheet drag-to-expand completo */
transition: transform var(--dur-long) var(--ease-ui);
```

Framer Motion equivalentes:
```ts
const uiEase = [0.2, 0.8, 0.2, 1];
const transitions = {
  micro:  { duration: 0.10, ease: uiEase },
  short:  { duration: 0.18, ease: uiEase },
  medium: { duration: 0.28, ease: uiEase },
  long:   { duration: 0.45, ease: uiEase },
};
```

---

## 6. Sistema de iconografía — lucide-react

**Regla única**: `size={20}` + `strokeWidth={1.75}` + `color="currentColor"` como defaults. Sobreescribir solo cuando sea justificado.

### Iconos por dominio (nombres exactos de lucide-react)

**Navegación principal (tab-bar)**
```
Mic          → tab Hablar (activo: filled variant manual vía fill)
FolderKanban → tab Proyectos
Wallet       → tab Finanzas
BookOpen     → tab Vault
User         → tab Cuenta
```

**Voz y conversación**
```
Mic, MicOff       → estados del botón de voz
Volume2           → reproduciendo audio
Headphones        → modo escucha activa
Radio             → streaming
AudioLines        → visualización de audio
```

**Finanzas**
```
Wallet            → saldo, finanzas general
ArrowDownCircle   → ingreso (usar color success)
ArrowUpCircle     → egreso (usar color danger)
Receipt           → transacción aprobada
CreditCard        → tarjeta, pago
Banknote          → efectivo
RefreshCcw        → recurrente
TrendingUp        → crecimiento, positivo
TrendingDown      → decrecimiento, negativo
CircleDollarSign  → monto, divisa
```

**Vault / Notas**
```
BookOpen          → vault general
Library           → colección de notas
FileText          → nota individual
Hash              → tag / etiqueta
Link2             → backlink
Quote             → cita RAG
Bookmark          → guardado
FolderOpen        → carpeta de notas
Search            → búsqueda RAG
```

**Agentes / IA**
```
Bot               → agente IA
Cpu               → procesamiento, thinking
Sparkles          → IA, plan Pro, features premium
Wrench            → configurar agente
Zap               → skill activa
PlugZap           → MCP conectado
CircuitBoard      → sistema, avanzado
Brain             → aprendizaje, memoria
```

**Proyectos / Tareas**
```
FolderKanban      → proyecto
ListChecks        → lista de tareas
CheckCircle2      → tarea completada
Circle            → tarea pendiente
Clock             → fecha límite
CalendarDays      → agenda
Flag              → prioridad
Target            → objetivo
```

**Sistema / UI**
```
Settings          → configuración general
Bell, BellOff     → notificaciones
LogOut            → cerrar sesión
Plus              → crear (FAB)
X                 → cerrar, descartar
ChevronRight      → navegar a detalle
ChevronDown       → expandir
ArrowLeft         → volver atrás
Search            → buscar
Filter            → filtrar
MoreVertical      → más opciones (kebab)
Check             → confirmación inline
AlertTriangle     → advertencia
AlertCircle       → error
Info              → información
Lock              → bloqueado, privacidad
Shield            → TokenGuard, seguridad
Eye, EyeOff       → mostrar/ocultar
```

**Conexiones / OAuth**
```
Mail              → Gmail
Calendar          → Google Calendar
MessageCircle     → Telegram
Instagram         → (lucide tiene Instagram icon)
ShoppingCart      → MercadoPago (fallback)
Unplug            → desconectar
```

**Acciones de swipe**
```
ThumbsUp          → aprobar borrador (verde)
ThumbsDown        → rechazar borrador (rojo)
Archive           → archivar
Trash2            → eliminar (solo en destructive)
```

---

## 7. Guía de uso de color

### Accent (`#7C5CFF` violeta)

Usar para:
- CTAs primarios (un solo botón principal por pantalla)
- Estado activo del tab-bar (icon + label se tiñen de accent)
- Focus ring en inputs
- Badge de plan "Pro"
- Barra de progreso de proyectos
- El Aura en estado idle

NO usar para:
- Texto de cuerpo o metadatos
- Backgrounds de pantalla completa
- Más de 2 elementos accent en el viewport simultáneamente (regla de moderación)

### Success (`#22C55E` verde)

Usar para:
- Ingresos financieros (monto en verde)
- Confirmación de aprobación de borrador
- Estado "Conectado" en OAuth
- Tarea completada
- Aura en estado listening

### Warning (`#F59E0B` ámbar)

Usar para:
- Borradores pendientes de aprobación (badge)
- Quota al 80% (barra de progreso vira a warning)
- Skill desactualizada (chip)
- Aura en estado thinking

### Danger (`#EF4444` rojo)

Usar para:
- Egresos financieros
- Rechazar borrador (swipe izquierda)
- Errores de API / conexión fallida
- Quota al 100%
- Acciones destructivas (botón "Eliminar cuenta")

### Info (`#60A5FA` azul)

Usar para:
- Notificaciones neutras del sistema
- Aura en estado speaking
- Tips de onboarding
- Información de plan (no urgente)

### Regla de moderación de color

```
Por pantalla completa:
  1 color accent (CTA principal)
  1 color semántico (si hay estado que comunicar)
  Todo lo demás: text-primary + text-secondary + border-subtle

En listas con items múltiples:
  Solo el estado más urgente usa color semántico
  El resto usa escala de grises
  NUNCA: red + green + yellow en el mismo viewport (sobrecarga cognitiva)
```

---

## 8. Anti-patterns prohibidos

### Elementos visuales
- **Emojis en UI cromática**: cero emojis en botones, labels, tabs, badges, cards, headers. Solo permitidos en burbujas conversacionales cuando el agente los genera.
- **shadcn/ui components**: no instalar ni usar. Usar los componentes custom de `/docs/components/`.
- **Heroicons como icono principal**: Lucide es la fuente única. Heroicons solo si Lucide no tiene el icono y no hay alternativa razonable.
- **Colores fuera de la paleta**: no inventar hex. Si el diseño pide un color no definido, usar el token más cercano o proponer extensión del sistema.
- **Gradientes de texto en UI funcional**: no usar `bg-clip-text` en labels, botones, ni metadatos. Solo permitido en elementos decorativos del onboarding hero.
- **Bordes gruesos**: `border-2` o mayor es excesivo. Usar `border` (1px) + `border-subtle` como máximo. `border-strong` solo para inputs activos y cards seleccionadas.
- **Backgrounds de color sólido en pantalla completa**: `bg-accent` en pantalla completa viola el principio de moderación. Solo en splash screen de onboarding (máximo 1 pantalla).
- **Spinner en lugar de skeleton**: skeleton en listas y cards. Spinner solo en acciones puntuales (submit de form, sheet en proceso).

### Estructura y layout
- **Grids que rompen el 8pt**: toda medida debe ser múltiplo de 4px.
- **Tap targets menores a 44×44pt**: aunque visualmente el icono sea 20px, el área táctil debe ser `min-h-[44px] min-w-[44px]`.
- **Acciones primarias en la parte superior en mobile**: zona difícil de alcance. Mover a la mitad inferior.
- **Texto truncado sin `title` o `aria-label`**: si se trunca, el usuario debe poder acceder al texto completo.
- **Navegación profunda sin botón "volver"**: todo stack push necesita flecha de retroceso en top-left.

### Código
- **Inline styles para colores**: usar clases Tailwind o variables CSS. `style={{ color: '#7C5CFF' }}` está prohibido excepto en canvas y SVG dinámicos.
- **Hardcoding de breakpoints**: usar `useBreakpoint()` hook del sistema, no `window.innerWidth` directo.
- **`z-index` ad hoc**: usar la escala definida: base(0), card(10), dropdown(20), sheet(30), toast(40), modal(50).

### Accesibilidad
- **Iconos sin label**: todo `<button>` con solo icono necesita `aria-label`. Todo icono informativo necesita `aria-hidden={false}` + título.
- **Contraste insuficiente**: `text-tertiary` (#6A6A7C) sobre `bg-base` (#07070A) = ratio 4.7:1 (ok). No bajar del mínimo WCAG AA.
- **Focus trap roto en sheets**: al abrir un BottomSheet, el focus debe quedar dentro. Al cerrarlo, volver al elemento que lo abrió.
- **Animaciones sin `prefers-reduced-motion`**: toda animación necesita su alternativa sin movimiento.
