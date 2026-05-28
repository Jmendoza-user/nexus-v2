# Brief de Diseño UI/UX Mobile-First — NEXUS V2.0

> Documento autosuficiente. Es el input completo para el agente de diseño. No requiere contexto adicional.

## 1. Resumen del producto

**NEXUS V2.0** es una plataforma SaaS B2C/B2B que entrega a cada usuario un **agente de IA personal autónomo** capaz de:

- Conversar por voz o texto desde una PWA mobile-first.
- Gestionar agenda, tareas, proyectos y rutinas.
- Detectar transacciones financieras automáticamente desde Gmail y proponerlas como **borradores que el usuario aprueba con un swipe**.
- Mantener un **segundo cerebro** estilo Obsidian (vault de notas Markdown interconectadas con RAG).
- Instalar y reparar skills/MCPs automáticamente (autocure).
- Ejecutar tareas avanzadas en el VPS (scraping headless, OCR de facturas, monitoreo cron).

**Público objetivo primario** (B2C): profesionales 28–45 años en Latinoamérica que ya usan apps como Notion, ChatGPT, Notion Calendar, Mint y quieren consolidarlo en un solo asistente proactivo. Pago en COP/USD vía MercadoPago.

**Público secundario** (B2B futuro): PyMEs (3–20 personas) que necesitan agentes compartidos y reportes.

**Stack frontend confirmado**: React 19 + TypeScript + Vite + Tailwind CSS 4 + Zustand + lucide-react + framer-motion. PWA con Service Worker. Rutas mobile bajo `/m/*`. Desktop SPA bajo `/app/*`.

## 2. Filosofía y principios de diseño

1. **Conversational-first, no chat-only**: la voz es la entrada principal en mobile. El usuario habla, el agente responde con voz natural (ElevenLabs Elisa María) + tarjeta visual con acción. Chat texto es respaldo, no protagonista.
2. **Human-in-the-Loop visible**: cuando la IA toma decisiones que afectan dinero o datos sensibles, **siempre hay aprobación humana explícita**. Las tarjetas de "Borrador" tienen acciones primarias claras (swipe-aprobar, swipe-rechazar).
3. **Cero emojis en UI cromática**: usar **lucide-react** (stroke uniforme, `currentColor`). Emojis solo en chat conversacional cuando el agente responde.
4. **Mobile-first real**: cada pantalla nace pensada en thumb-zone (alcance del pulgar), no en escritorio escalado. Acciones primarias en mitad inferior. Navegación tab-bar fija.
5. **Velocidad percibida > velocidad real**: optimistic UI en aprobaciones, skeleton loaders en listas, transiciones <150ms. La voz nunca espera más de 8s end-to-end (Whisper + LLM + TTS).
6. **Densidad informativa controlada**: una tarjeta = una decisión. Listas con divisores sutiles, no bordes pesados. Whitespace generoso.
7. **Accesibilidad WCAG 2.2 AA** desde día 1: contraste mínimo 4.5:1 en texto, tap targets ≥44×44pt, focus visible, screen reader (VoiceOver/TalkBack) testeado.
8. **Privacidad como feature**: el TokenGuard, los borradores financieros, los OAuth granulares deben **comunicarse como ventaja** (badges "Tu data se queda en tu VPS").

## 3. Sistema de diseño (tokens)

### 3.1 Paleta — modo oscuro (default)

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg-base` | `#07070A` | Fondo de la app |
| `--bg-surface` | `#101015` | Cards, sheets, modales |
| `--bg-elevated` | `#1A1A22` | Hover, foco, popovers |
| `--border-subtle` | `#1F1F29` | Divisores |
| `--border-strong` | `#2A2A36` | Inputs, cards de selección |
| `--text-primary` | `#F4F4F7` | Titulares, cuerpo |
| `--text-secondary` | `#A8A8B8` | Metadata, hints |
| `--text-tertiary` | `#6A6A7C` | Placeholder, disabled |
| `--accent` | `#7C5CFF` | Marca principal (violeta vibrante) |
| `--accent-soft` | `#7C5CFF1A` | Fondos translúcidos, focus |
| `--state-listening` | `#34D399` | Aura escuchando |
| `--state-thinking` | `#FBBF24` | Aura procesando |
| `--state-speaking` | `#3B82F6` | Aura hablando |
| `--success` | `#22C55E` | Confirmaciones, balance positivo |
| `--warning` | `#F59E0B` | Borradores pendientes, quota 80% |
| `--danger` | `#EF4444` | Rechazos, errores, gastos |
| `--info` | `#60A5FA` | Avisos neutros |

### 3.2 Paleta — modo claro

Espejo simétrico. Tokens equivalentes con `--bg-base: #FAFAFB`, `--bg-surface: #FFFFFF`, `--text-primary: #0A0A12`, `--text-secondary: #4A4A5C`, `--border-subtle: #E5E5EA`, accent mantiene `#7C5CFF`.

### 3.3 Tipografía

- **Sans (UI)**: `Inter` (variable) — pesos 400/500/600/700.
- **Display (titulares hero)**: `Space Grotesk` 500/700 — opcional, solo en onboarding y landing.
- **Mono (códigos, IDs, debug)**: `JetBrains Mono` 400/500.

Escala (rem, base 16):

| Token | Tamaño | Line-height | Uso |
|-------|--------|-------------|-----|
| `text-xs` | 0.75 | 1.4 | Metadata, badges |
| `text-sm` | 0.875 | 1.5 | Cuerpo secundario, hints |
| `text-base` | 1 | 1.55 | Cuerpo |
| `text-lg` | 1.125 | 1.5 | Subtítulos, lead de card |
| `text-xl` | 1.25 | 1.4 | Título de sección |
| `text-2xl` | 1.5 | 1.3 | Título de pantalla |
| `text-3xl` | 1.875 | 1.2 | Hero (onboarding, vacío) |
| `text-4xl` | 2.25 | 1.15 | Display (montos, balance) |

### 3.4 Espaciado (8-pt grid)

`space-1` = 4px, `space-2` = 8px, `space-3` = 12px, `space-4` = 16px, `space-5` = 20px, `space-6` = 24px, `space-8` = 32px, `space-10` = 40px, `space-12` = 48px, `space-16` = 64px.

### 3.5 Radii

- `rounded-sm` 6px (inputs)
- `rounded-md` 10px (botones, badges)
- `rounded-lg` 14px (cards)
- `rounded-xl` 20px (sheets, modales)
- `rounded-2xl` 28px (botón flotante mic)
- `rounded-full` (avatars, FAB)

### 3.6 Sombras

Solo en modo claro. En modo oscuro: usar `--bg-elevated` + `--border-subtle` para elevación.

- `shadow-card`: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- `shadow-elevated`: `0 12px 32px rgba(124,92,255,0.18), 0 4px 8px rgba(0,0,0,0.06)`

### 3.7 Iconografía

- **Librería única**: `lucide-react` (NO mezclar con Heroicons salvo fallback puntual).
- Stroke `1.75`, tamaño base `20px`, color heredado de `currentColor`.
- Iconos clave por dominio:
  - Voz: `Mic`, `MicOff`, `Volume2`, `Headphones`
  - Finanzas: `Wallet`, `ArrowDownCircle` (ingreso), `ArrowUpCircle` (egreso), `Receipt`, `CreditCard`
  - Vault: `BookOpen`, `Library`, `FileText`, `Hash`
  - Agentes: `Bot`, `Cpu`, `Sparkles`, `Wrench` (config)
  - Proyectos: `FolderKanban`, `ListChecks`, `Calendar`
  - Sistema: `Settings`, `Bell`, `LogOut`, `Plus`, `Search`

### 3.8 Movimiento

- **Easing**: `cubic-bezier(0.2, 0.8, 0.2, 1)` (suave, ligeramente energético).
- Duración: micro (100ms), short (180ms), medium (280ms), long (450ms para sheets).
- Animaciones notables: Aura visualizer (canvas con partículas reactivas a amplitud de voz), swipe approve/reject (180ms slide-out + 80ms scale-in del siguiente).

## 4. Arquitectura de navegación PWA `/m/*`

**Tab-bar fija (5 slots)** en la parte inferior con safe-area iOS:

| Slot | Ruta | Icono | Etiqueta |
|------|------|-------|----------|
| 1 | `/m/` | `Mic` | Hablar |
| 2 | `/m/proyectos` | `FolderKanban` | Proyectos |
| 3 | `/m/finanzas` | `Wallet` | Finanzas |
| 4 | `/m/vault` | `BookOpen` | Vault |
| 5 | `/m/cuenta` | `User` | Cuenta |

**Patrón de navegación secundaria**: `bottom sheets` (no modales fullscreen) para detalle de tareas, edición de transacción, configuración de skill. Top-bar minimal (logo izquierda, contextual centro, acción derecha como `Plus` o `Settings`).

**Rutas profundas** (push de stack, transición slide):
- `/m/proyectos/:id` → detalle proyecto con sub-tareas
- `/m/proyectos/:id/tarea/:taskId` → edición tarea con timeline
- `/m/finanzas/borrador/:txId` → revisión transacción + evidencia
- `/m/vault/:notePath` → editor de nota markdown con preview
- `/m/agentes/:id` → detalle agente + runs recientes
- `/m/config/{principal,agentes,skills,mcp,conexiones,formatos,seguridad,planes}` → secciones de configuración (accesibles desde `/m/cuenta`)

**Onboarding flow** (fuera del tab-bar, no se puede salir hasta completar):
1. `/m/onboarding/bienvenida` — hero con voz de bienvenida
2. `/m/onboarding/cuenta` — email + password + términos
3. `/m/onboarding/perfil` — nombre, locale, zona horaria
4. `/m/onboarding/permisos` — micrófono, notificaciones, instalar PWA
5. `/m/onboarding/agentes` — selección/edición de los 3 agentes base
6. `/m/onboarding/conexiones` — Gmail (opcional pero recomendado), Google Calendar, Telegram pairing
7. `/m/onboarding/plan` — elegir Free o Pro (trial 14 días)
8. `/m/onboarding/listo` — animación celebratoria + redirige a `/m/`

## 5. Inventario de pantallas

### Pantallas principales (siempre en tab-bar)

1. **`/m/` — Home conversacional**
   - Centro: **Aura visualizer** (canvas circular ~220px con partículas reactivas; cambia color según estado idle/listening/thinking/speaking).
   - Debajo del Aura: **transcript flotante** (max 3 líneas, fade-in del último turno).
   - Sobre Aura: saludo contextual ("Buenas tardes, Jerson. Tienes 3 borradores y 2 tareas vencen hoy").
   - **Botón mic** grande circular (80×80, FAB centrado) sobre el tab-bar. Tap inicia escucha; long-press cambia a modo texto.
   - Esquina superior derecha: badge con conteo de notificaciones (`Bell` con dot rojo si pendientes).
   - Esquina superior izquierda: avatar usuario (abre drawer con planes y logout).

2. **`/m/proyectos` — Lista jerárquica**
   - Header: "Proyectos" + filtro segmentado (Activos / Backlog / Cerrados).
   - Cada card: nombre, % progreso (barra delgada), agente asignado (chip mini con avatar), próxima tarea, fecha objetivo.
   - FAB inferior derecho `Plus` para crear proyecto (abre bottom sheet con campos esenciales).
   - Empty state: ilustración + "Crea tu primer proyecto" + botón.

3. **`/m/finanzas` — Resumen + Inbox de borradores**
   - Header: balance del mes actual en grande (`text-4xl`, color según positivo/negativo) + sub-línea "vs mes anterior +12%".
   - Tabs segmentados: **Resumen | Inbox (badge n) | Historial**.
   - **Tab Inbox** (el más importante): cada borrador es una **swipe card**:
     - Estructura: ícono categoría | comercio | monto | fecha-hora | confianza IA (chip).
     - Swipe derecha → aprobar (verde, haptic light). Swipe izquierda → rechazar (rojo, haptic medium).
     - Tap → abre `/m/finanzas/borrador/:txId` con detalle + evidencia.
   - **Tab Resumen**: gráfico de barras semanal (ingresos vs egresos), top 5 categorías del mes, próximos pagos automáticos.
   - **Tab Historial**: lista cronológica con filtros (rango fecha, tipo, categoría, canal).

4. **`/m/vault` — Segundo cerebro**
   - Header: "Vault" + buscador prominente con autocompletar de notas y conceptos.
   - Vista por defecto: **mosaic de tarjetas recientes** (3 columnas en tablet, 2 en mobile, 1 en mobile pequeño).
   - Cada card: título de nota, primer párrafo, tags, fecha modificada, indicador de backlinks.
   - Bottom sheet con filtros: por carpeta (Diarios, Conceptos, Preferencias, custom), por tag, por fecha.
   - **Búsqueda RAG**: al escribir una pregunta natural, además de matches por texto aparece arriba una respuesta generada con citas a notas (cards mini con `Quote` icon).
   - FAB `Plus` → bottom sheet "Nueva nota" con plantilla (Diaria / Concepto / Libre).

5. **`/m/cuenta` — Hub de configuración + perfil**
   - Top: avatar grande + nombre + email + plan actual (badge "Pro" con `Sparkles`).
   - Cards de uso del mes: mensajes IA usados / cupo, voz segundos / cupo, vault MB / cupo. Barras de progreso con color amarillo al 80%, rojo al 100%.
   - Lista de secciones (chevron derecha):
     - **Asistente principal** (system prompt, tono, voz seleccionada)
     - **Mis agentes** (gestión skills/MCPs/configuraciones)
     - **Conexiones** (Gmail, Calendar, Telegram, IG, MercadoPago)
     - **Seguridad y privacidad** (Token Guard, redactions log)
     - **Plan y facturación** (cambiar plan, ver facturas)
     - **Preferencias** (idioma, tema, notificaciones)
     - **Cerrar sesión**

### Pantallas de detalle / config

6. **`/m/proyectos/:id`** — Header con título editable, % progreso, agente líder, fechas. Stack de sub-tareas con checkbox + chevron a detalle. Tab secundaria: Notas (vinculadas al vault).
7. **`/m/finanzas/borrador/:txId`** — Card grande con monto y comercio, sección "Evidencia" (snippet del correo Gmail con highlight de monto/fecha; foto OCR si aplica), sección "Clasificación IA" (categoría editable, confianza), botones grandes "Aprobar" (primary) y "Rechazar" (secondary destructive). Bottom: "Marcar como recurrente" (toggle), "Editar antes de aprobar".
8. **`/m/vault/:notePath`** — Editor en dos modos: visual (TipTap o Lexical, no Markdown raw) y código (CodeMirror para usuarios avanzados, toggle en top-bar). Bottom sheet "Backlinks y referencias" con notas relacionadas y queries RAG sobre la nota.
9. **`/m/agentes/:id`** — Avatar agente, status pill (Idle/Running/Paused), descripción, skills habilitadas (chips con `X` para desinstalar), botón "Hablar con este agente" (lleva a `/m/` con contexto pre-cargado), historial de runs recientes (timeline con duración y costo).
10. **`/m/config/principal`** — Editor de system prompt con sugerencias (cards "Más formal" / "Más casual" / "Más conciso"), selector de voz (preview play con sample), nivel de proactividad (slider 1–5 con descripción).
11. **`/m/config/skills`** — Catálogo en grid de skills disponibles (instaladas vs disponibles); tap → bottom sheet con descripción, capabilities, MCPs requeridos, botón Instalar (con flujo autocure visible si falla).
12. **`/m/config/conexiones`** — Lista de proveedores (Gmail, GCal, Meta, Telegram, MercadoPago). Cada uno: ícono oficial, status (Conectado / Desconectado / Expira en X días), botón Conectar / Reautorizar / Desconectar.
13. **`/m/config/seguridad`** — Toggle TokenGuard (on/off, on=default Pro+), tabla de últimas 20 redactions (qué fue ocultado), botón "Borrar mi cuenta" (flujo de confirmación con typing de "ELIMINAR").
14. **`/m/upgrade`** — 3 cards de planes verticales en mobile (Free/Pro/Team) con features destacados, CTA "Cambiar a Pro" → MercadoPago checkout en webview embebido.

### Pantallas de sistema

15. **`/m/login`** — Hero minimal con logo, campos email/password, link "Crear cuenta", botón "Continuar con Google" (futuro).
16. **`/m/notificaciones`** — Stack de notificaciones agrupadas por día (borradores pendientes, runs completados, alertas de cron, hitos de quota).

## 6. Patrones de interacción mobile

| Patrón | Cuándo | Detalle |
|--------|--------|---------|
| **Swipe horizontal en card** | Borradores financieros, tareas | Derecha = positivo (aprobar/completar), izquierda = negativo (rechazar/archivar). Threshold 30% del ancho. Haptic feedback (`navigator.vibrate(20)` Android, `Haptics.impactOccurred('light')` iOS PWA si disponible). |
| **Bottom sheet** | Crear, editar, filtrar, ver detalle ligero | Altura inicial ~60% viewport, drag-to-expand a 95%, drag-to-dismiss. `border-radius` 20px en top corners. Backdrop con `bg-black/40 + backdrop-blur-sm`. |
| **Long-press en mic** | Cambiar a modo texto | Muestra teclado y caja de texto inline en lugar de escucha. |
| **Pull-to-refresh** | Listas (proyectos, vault, historial finanzas) | Spinner custom con accent color. |
| **Optimistic UI** | Aprobar borrador, completar tarea, agregar nota | Cambio visual inmediato + revert si la API falla con toast de error. |
| **Skeleton loaders** | Carga inicial de listas | Shimmer sutil 1.2s loop, sin spinners salvo en sheets de acción. |
| **Empty states** | Cualquier lista vacía | Ilustración minimal (line icon Lucide grande + 60% opacidad), título amable, CTA primario. NUNCA dejar pantalla en blanco. |
| **Toasts** | Confirmaciones, errores leves | Aparecen abajo (sobre tab-bar), 3s autodismiss, tap para cerrar antes. Posición no bloquea mic. |
| **Confirm dialogs** | Acciones destructivas | Modal centrado pequeño, 2 botones (cancelar secundario, confirmar destructive). Para borrado de cuenta: confirmación por escritura de palabra. |

## 7. Componentes clave (librería)

Categorías para la librería React/Tailwind:

**Layout**: AppShell, TabBar, TopBar, BottomSheet, Modal, Drawer, SafeArea.
**Tipografía**: Heading (h1-h4), Text (variantes primary/secondary/tertiary), Label, Caption, Mono.
**Inputs**: TextField, TextArea, PasswordField, NumberField, Select, Combobox, Toggle, Checkbox, Radio, Slider, ChipInput, SearchBar.
**Botones**: Button (primary/secondary/ghost/destructive, sizes sm/md/lg/icon), FAB, IconButton, SegmentedControl, LinkButton.
**Display**: Card, ListItem, Chip, Badge, Avatar, Divider, ProgressBar, Skeleton, EmptyState, Stat (para balance, etc.).
**Feedback**: Toast, Banner, Alert, Tooltip, Spinner, ConfirmDialog.
**Conversational**: AuraVisualizer, TranscriptBubble, VoiceButton, MicButton, AssistantTurnCard.
**Domain-específicos**:
- `TransactionDraftCard` (con swipe actions)
- `ProjectCard`, `TaskRow`, `SubtaskItem`
- `VaultNoteCard`, `VaultEditor`, `BacklinkChip`, `RagCitationCard`
- `AgentCard`, `SkillCard`, `MCPCard`, `ConnectionRow`
- `PlanCard`, `QuotaBar`, `UsageMeter`
- `OAuthConnectButton`, `TelegramPairingCard`
- `OnboardingStep`, `OnboardingProgressDots`

Cada componente debe documentar: props, variantes, estados (default/hover/active/disabled/loading/error), comportamiento responsive, accesibilidad (roles ARIA), ejemplos de uso.

## 8. Estados universales

Para cada vista de datos definir:
- **Loading**: skeleton inicial 0–2s, después spinner discreto.
- **Empty**: ilustración + título + CTA.
- **Error**: ícono `AlertTriangle` + mensaje humano + botón "Reintentar" + link "Reportar problema" (manda a Telegram bot soporte).
- **Offline**: banner top "Sin conexión — viendo cache" con `WifiOff`.
- **Quota bloqueada**: banner top con `Lock` + "Llegaste al límite de tu plan" + CTA "Mejorar plan".
- **Tier downgrade**: cuando un user Free intenta acción Pro, modal con preview + CTA upgrade (no error).

## 9. Accesibilidad WCAG 2.2 AA (checklist)

- Contraste texto ≥4.5:1; texto grande ≥3:1; iconografía ≥3:1 contra fondo.
- Todo botón/link con focus visible (ring 2px `--accent`, offset 2px).
- Tap targets ≥44×44pt; espaciado mínimo entre targets adyacentes 8px.
- Etiquetas explícitas en inputs (`<label>` o `aria-label`).
- Roles ARIA: `role="tab"` en TabBar, `role="dialog"` con `aria-modal="true"` en sheets, `role="status"` en toasts, `role="alert"` en errores críticos.
- Soporte completo de teclado (PWA usable desde Bluetooth keyboard): Tab/Shift+Tab, Enter activa, Esc cierra sheets.
- Compatibilidad screen reader testeada con VoiceOver (iOS) y TalkBack (Android).
- Soporte para `prefers-reduced-motion` (deshabilita Aura animado, transiciones <100ms).
- Soporte para `prefers-color-scheme`.
- Textos legibles a 200% zoom sin scroll horizontal.
- Idioma declarado en `<html lang="es-CO">`; secciones con cambio de idioma marcadas.

## 10. Performance mobile (PWA)

- **TTI (Time to Interactive)** <2.5s en 4G mid-range Android (Moto G Power).
- **Bundle inicial JS** <120KB gzipped (code splitting agresivo por ruta).
- **First Contentful Paint** <1.5s en wifi.
- **Imágenes**: usar `<picture>` con AVIF + WebP fallback; ilustraciones SVG inline.
- **Web Vitals targets**: LCP <2.5s, CLS <0.1, INP <200ms.
- **Service Worker**: estrategia stale-while-revalidate para API GET, network-first para `/api/assistant/*` y `/api/voice/*`, cache-first para assets estáticos. Background sync para acciones offline (aprobaciones financieras se encolan).
- **Pre-fetch**: al cargar `/m/`, prefetch de `/m/finanzas` y `/m/proyectos` (rutas más usadas).
- **Lazy load**: TipTap/Lexical, gráficos (Chart.js), canvas Aura.
- **Fuentes**: subsetting + `font-display: swap`; cargar Inter completo, Space Grotesk solo cuando se requiera.
- **WebSocket**: una sola conexión persistente `/ws` con reconnect exponential backoff.

## 11. Microcopy y tono

**Voz de marca**: cercana, profesional, en español neutro LATAM (no españolismos). Tutea ("tú", no "usted"). Concisa. Sin emojis en UI. Usa el nombre del usuario cuando aporta calidez.

**Ejemplos**:
- En lugar de "Error 500": "Algo no salió bien. Inténtalo en un momento."
- En lugar de "Saving...": "Guardando".
- En lugar de "Add Transaction": "Registrar movimiento".
- En lugar de "Approve": "Aprobar" (no "Aceptar").
- Saludo home: "Buenas tardes, Jerson. Tienes 3 borradores y 2 tareas vencen hoy." (datos reales, no plantilla genérica).
- Empty vault: "Tu vault está vacío. La primera nota es el inicio de un segundo cerebro." + botón "Crear nota".
- Quota 80%: "Llevas 4.1k de 5k mensajes este mes. Te quedan ~3 días al ritmo actual."
- Borrar cuenta: "Esto eliminará tu vault, tus notas, tus conexiones y tus borradores. No se puede deshacer."

**Idioma del asistente conversacional**: hereda preferencias del user. Para Jerson: tono neutro-cercano, respuestas concisas, sin filler. Para users nuevos: tono cálido y guiador hasta que el agente aprenda preferencias (Preferencias.md auto-evoluciona).

## 12. Modo dark/light

- Default `dark` (la mayoría de users power llegará desde Telegram/PWA, contexto noche).
- Toggle en `/m/config/preferencias` con opciones: Automático (sistema), Oscuro, Claro.
- Implementar con CSS variables; cambio instantáneo sin reload.
- Logo y favicons adaptan.
- Capturas de marketing: ambos modos.

## 13. Diferencias mobile vs desktop

| Aspecto | Mobile (`/m/*`) | Desktop (`/app/*`) |
|---------|-----------------|---------------------|
| Navegación | Tab-bar inferior 5 slots | Sidebar izquierdo persistente |
| Vault | Mosaic cards | Editor 2-column (tree + content + backlinks panel) |
| Finanzas | Inbox con swipe | Tabla con bulk-actions + columns sortables + sidebar de detalle |
| Proyectos | Cards stack | Kanban board con drag&drop |
| Chat | Aura central + transcript flotante | Panel chat clásico con historial visible |
| Comandos rápidos | No aplica | `Cmd+K` palette estilo Linear |
| Onboarding | Stack vertical scroll | Stepper horizontal centrado |

Componentes deben aceptar prop `layout="mobile" | "desktop"` o detectar viewport con hook `useBreakpoint()`.

## 14. Entregables esperados del agente de diseño

1. **Sistema de diseño completo** documentado en archivo `/root/nexus-v2/docs/design-system.md` con tokens implementables (variables CSS + Tailwind config v4 con `@theme`).
2. **Mockups de las 16 pantallas principales** en alta fidelidad. Formato preferido: componentes React funcionales con datos mock en `/root/nexus-v2/docs/mockups/`, complementados con descripciones ASCII/SVG si Figma no es viable.
3. **Librería de componentes React** en `/root/nexus-v2/docs/components/` con TypeScript, props tipadas, ejemplos de uso embedded como comentarios JSDoc.
4. **Set de ilustraciones** para empty states (8-10 ilustraciones line-art SVG coherentes con la marca) en `/root/nexus-v2/docs/illustrations/`.
5. **Especificación de animaciones** del Aura visualizer (canvas, parámetros, código de referencia) en `/root/nexus-v2/docs/aura-spec.md`.
6. **Manual de marca corto**: logo, paleta, tipografía, do/don'ts (≤8 páginas) para uso en marketing en `/root/nexus-v2/docs/brand-manual.md`.
7. **Prototipo navegable simulado** (flow descrito paso a paso con capturas/mockups) del flujo onboarding completo y del flujo "aprobar 3 borradores financieros" en `/root/nexus-v2/docs/prototype-flows.md`.

## 15. Referencias visuales (mood board)

- **Linear** (densidad informativa controlada, dark mode pulido, palette violeta).
- **Things 3** (jerarquía suave, tipografía generosa, micro-interacciones).
- **Cash App** (UI financiera mobile-first, swipe actions, color confidence).
- **Granola** (PWA conversacional con captura de voz elegante).
- **Mem.ai / Reflect** (segundo cerebro UX con backlinks visibles).
- **Replit Mobile** (agente IA en mobile, chat + actions panel).

---

> Fin del Brief. Documento autosuficiente para que un agente de diseño produzca el sistema completo.
