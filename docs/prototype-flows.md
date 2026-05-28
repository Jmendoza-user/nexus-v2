# Prototype Flows — NEXUS V2.0

> Dos flujos prototipados paso a paso. Cada paso incluye descripción visual densa, microcopy exacto, estado de componentes y transición al siguiente.

---

## Flujo A — Onboarding completo (8 pasos)

### Contexto
Usuario nuevo: "Laura Rodríguez", Bogotá, Colombia. Llega desde un link de Instagram. Instala la PWA. Versión Free que puede convertir a Pro en el paso 7.

---

### Paso 1: Bienvenida (`/m/onboarding/bienvenida`)

**Qué se ve:**
Pantalla dividida en dos mitades. La superior ocupa 55vh con un fondo `#07070A` y en el centro el Aura en estado `idle` (violeta pulsante, 180px). Alrededor, 12 puntos de luz distribuidos aleatoriamente simulan una constelación. La inferior tiene fondo liso con el logo NEXUS (wordmark Space Grotesk 700) y el headline.

**Componentes activos:**
- `AuraVisualizer` en `idle`, tamaño 180px, sin AnalyserNode
- Logo wordmark centrado
- Headline: `text-3xl font-bold` Space Grotesk — "Tu agente personal. Habla, actúa, aprende."
- Subtítulo: `text-base text-secondary` — "El primer asistente de IA que habla contigo en español. Para profesionales que quieren más tiempo."
- Botón primary `lg` — "Comenzar gratis"
- Link secundario ghost debajo — "Ya tengo cuenta →"
- Sin tab-bar (onboarding fullscreen)

**Audio automático (si permisos):**
Voz Elisa María reproduce: "Hola. Soy tu nuevo agente personal. Configúranos en tres minutos y empezamos." (3.2s). Si no hay permisos, transcript aparece en texto fade-in.

**Transición al siguiente:**
Tap en "Comenzar gratis" → slide-right (push de stack) 280ms. El Aura hace una pulsación extra (scale 1.1 → 1.0 en 180ms) como confirmación visual.

---

### Paso 2: Crear cuenta (`/m/onboarding/cuenta`)

**Qué se ve:**
`OnboardingStep` con dots de progreso (dot 1 de 8 activo, estilo pill alargado #7C5CFF). Arriba del dot-bar: botón ghost "← Volver" en top-left.

Header:
- Dot progress bar (8 dots, 1 activo = pill, resto = círculos pequeños)
- Título: "Crea tu cuenta" (Space Grotesk 700, `text-3xl`)
- Subtítulo: "Solo te pedimos lo esencial. Sin spam, sin datos innecesarios."

Form:
- `TextField` "Correo electrónico" con `type="email"`, placeholder "laura@ejemplo.com"
- `PasswordField` "Contraseña", hint `text-xs text-tertiary`: "Mínimo 8 caracteres"
- Checkbox "Acepto los Términos de uso y la Política de privacidad" (label con links en accent)

Botón primary "Continuar" en full-width `rounded-2xl` sticky en el bottom (sobre el teclado virtual).

**Estados de validación inline:**
- Email inválido: borde `border-danger`, helper `text-danger text-xs`: "Ingresa un correo válido"
- Contraseña débil: borde `border-warning`, helper `text-warning text-xs`: "Agrega un número o símbolo"
- Términos sin aceptar: el botón "Continuar" permanece `disabled` (opacidad 40%)

**Transición:**
Al tap "Continuar" y validación OK → spinner 800ms (llamada API) → slide al paso 3. Si error de red: toast `variant="error"`: "Algo no salió bien. Inténtalo en un momento."

---

### Paso 3: Perfil (`/m/onboarding/perfil`)

**Qué se ve:**
Dots progress (2 activo). Título "Cuéntanos sobre ti".

Form:
- `TextField` "¿Cómo te llamamos?" placeholder "Laura", `type="text"` autofocus
- `Select` (select visual con chevron) "País" — opciones Colombia, Venezuela, México, Otro (COP/VES/MXN auto-detecta)
- `SegmentedControl` "Zona horaria" con 3 opciones: "Bogotá (-5)", "Caracas (-4)", "Ciudad de México (-6)". Selección default basada en locale del navegador.

Subtexto bajo el form: `text-xs text-tertiary` "Usamos tu nombre para que el agente te llame por tu nombre. Sin más."

Botón "Continuar" sticky bottom.

**Transición:**
Slide al paso 4. El agente ahora sabe el nombre: en los siguientes pasos el copy usa "Laura".

---

### Paso 4: Permisos (`/m/onboarding/permisos`)

**Qué se ve:**
Dots progress (3 activo). Título "Tres permisos, un agente completo".

Tres cards de permiso apiladas, cada una con estado visual:

**Card 1 — Micrófono**
`bg-bg-surface border border-border-subtle rounded-lg p-4`
Left: icono `Mic` con fondo `bg-accent/10 text-accent`
Título: "Micrófono"
Subtítulo: "Para hablar con tu agente en lugar de escribir."
Estado badge derecha: pill "Pendiente" `bg-warning/10 text-warning`
Tap → native permission dialog → si aprueba: badge cambia a "Activo" `bg-success/10 text-success` + icono `CheckCircle2`

**Card 2 — Notificaciones**
Icono `Bell`. Título: "Notificaciones"
Subtítulo: "Para avisarte de borradores, tareas y actualizaciones."
Estado: "Pendiente" → aprobado: "Activo"

**Card 3 — Instalar la app**
Icono `Download`. Título: "Instalar NEXUS"
Subtítulo: "Agrégala a tu pantalla de inicio para acceso rápido."
iOS: muestra instrucción "Toca compartir → Agregar a inicio"
Android: botón nativo PWA install prompt

Nota al fondo: `text-xs text-tertiary` "Puedes cambiar estos permisos en cualquier momento desde Configuración."

Botón "Continuar" abajo (activo aunque no se aprueben todos — los permisos son opcionales).

**Transición:** Slide al paso 5.

---

### Paso 5: Agentes (`/m/onboarding/agentes`)

**Qué se ve:**
Dots progress (4 activo). Título "Tu equipo de agentes" — subtitle "Elige los 3 agentes base. Puedes agregar más después."

Grid 2×3 de `AgentCard` (estilo compacto, sin last run):
```
[HEFESTO — Código]    [APOLO — Diseño]
[THEMIS — Legal]      [PLUTO — Finanzas]
[CHIRON — Bienestar]  [METIS — Email]
```

Por defecto, los 3 primeros están seleccionados (borde `border-accent` + badge checkmark `bg-accent` en esquina). Tap togglea selección. Máximo 3 seleccionados (plan Free). Si se intenta seleccionar un 4to → toast `variant="info"`: "Con el plan Free tienes 3 agentes. Puedes agregar más con Pro."

Cada card al tap muestra un micro-tooltip debajo (AnimatePresence fade-in): descripción del agente en 1 línea.

Botón "Continuar con N agentes seleccionados" donde N se actualiza dinámicamente.

**Transición:** Slide al paso 6.

---

### Paso 6: Conexiones (`/m/onboarding/conexiones`)

**Qué se ve:**
Dots progress (5 activo). Título "Conecta tus herramientas" — subtitle "Las conexiones hacen al agente poderoso. Gmail es la más importante para finanzas."

Lista de `OAuthConnectButton` apilados:
1. **Gmail** — status "disconnected" + badge recomendado (`bg-accent/10 text-accent text-[10px]`: "Recomendado") → tap abre OAuth flow en webview
2. **Google Calendar** — status "disconnected"
3. **Telegram** — status "disconnected" — muestra QR o link de pairing
4. **MercadoPago** — status "disconnected" — etiqueta "Para cobros"

Al conectar Gmail: el status cambia a "connected" con cuenta visible. Toast: "Gmail conectado. El agente ya puede detectar transacciones."

Botón "Saltar por ahora" ghost debajo del CTA "Continuar" (no bloquea el onboarding).

**Transición:** Slide al paso 7.

---

### Paso 7: Plan (`/m/onboarding/plan`)

**Qué se ve:**
Dots progress (6 activo). Título "Elige tu plan".

Dos cards apiladas (Free y Pro). La card de Pro tiene el badge "14 días gratis" y borde `border-accent`. La card Free tiene badge "Tu plan actual".

**Card Free:**
Precio: Gratis · siempre
Features: 500 msgs/mes, 100s voz, 1 agente, sin finanzas, sin TokenGuard
CTA: "Continuar gratis" (ghost button)

**Card Pro:**
Precio: COP 45.000/mes · ~11 USD
Features (lista con checks verdes): 5.000 msgs, 5.000s voz, 3 agentes, borradores ilimitados, TokenGuard, Gmail+Calendar
CTA: "Empezar prueba gratuita" (primary button)
Sub-nota: "Sin cobros hoy. Cancela cuando quieras."

Tap "Empezar prueba" → webview MercadoPago o Stripe (según país) con checkout. Tap "Continuar gratis" → paso 8 directamente.

**Transición:**
- Si elige Pro y pago exitoso → toast `variant="success"`: "Plan Pro activado. 14 días sin cobro." → slide paso 8
- Si elige Free → slide directo paso 8

---

### Paso 8: Listo (`/m/onboarding/listo`)

**Qué se ve:**
Pantalla de celebración. Full-screen, sin dots de progreso ni botón volver.

Centro: Aura en estado `speaking` (azul) girando a `idle` (violeta) en 1.5s, tamaño 200px.
Sobre el Aura: confetti de partículas cuadradas (framer-motion, 20 partículas, colores de la paleta, caen en 1.5s, no afecta rendimiento).

Título: "Laura, tu agente está listo." Space Grotesk 700 `text-3xl`
Subtítulo: "Habla conmigo en cualquier momento. Empieza con un 'Hola'."

Agentes conectados chips:
Row de 3 chips `bg-accent/10 text-accent rounded-full`: "[Bot] HEFESTO" "[Bot] APOLO" "[Bot] PLUTO"

Botón primary full-width: "Ir a NEXUS →" (rounded-2xl)

**Audio:**
Elisa María: "Hola Laura. Estoy lista. ¿Por dónde empezamos?"

**Transición:**
Tap "Ir a NEXUS" → cross-fade (no slide) al home `/m/` con Aura ya en estado `idle`. La tab-bar aparece con animación slide-up 280ms. El saludo contextual del home ya muestra el nombre de Laura.

---

## Flujo B — Aprobar 3 borradores financieros

### Contexto
Jerson recibe una notificación push de Telegram: "Tienes 3 borradores nuevos para revisar." Abre la PWA desde el link. Son las 21:45 del 28 mayo 2026.

---

### Paso 1: Entrada desde notificación

**Qué se ve:**
Jerson toca la notificación en Telegram. El navegador abre `/m/finanzas` directamente (deep link con query param `?tab=inbox`). La app carga con skeleton loader 0.8s.

Skeleton de la pantalla de finanzas:
- Header: `SkeletonCard` de 2 líneas (balance + subtítulo)
- SegmentedControl: skeleton de 3 tabs
- 3 `SkeletonListItem` apilados

Al cargar (800ms en 4G): aparece la pantalla de finanzas con tab "Inbox" activo y badge "3".

**Estado de la pantalla de finanzas al cargarse:**
- Balance mayo: COP $3.845.200 en verde `text-success text-4xl`
- Sub-balance: "+12.4% vs abril" con `TrendingUp` verde
- Tab Inbox activo (pill `bg-accent text-white`) con badge "3"
- Instrucción swipe: "Desliza para aprobar o rechazar" en `text-tertiary text-xs`

**Transición:** Pantalla ya cargada. No hay transición — usuario ya está en el contenido.

---

### Paso 2: Revisar inbox — 3 borradores visibles

**Qué se ve:**
Lista de 3 `TransactionDraftCard` apiladas con gap-3:

1. **Netflix — -COP $47.900** (08:14, Suscripciones, 97% confianza, Recurrente)
2. **Mercado Libre — -COP $185.000** (21:53, Compras, 89% confianza)
3. **J4 ingreso cliente — +COP $2.400.000** (16:30, Ingresos, 94% confianza)

Cada card tiene:
- Fondo de acción izquierda (`bg-danger/10 + ThumbsDown`) visible al 0% opacidad
- Fondo de acción derecha (`bg-success/10 + ThumbsUp`) visible al 0% opacidad
- La card en sí sobre el fondo, con drag horizontal disponible

Jerson lee las cards. Quiere aprobar Netflix rápido (recurrente, confianza 97%), editar la de Mercado Libre (verificar qué era), y rechazar el ingreso hasta confirmación (espera transferencia del banco).

**Transición:** El usuario inicia el swipe de la primera card.

---

### Paso 3: Swipe-aprobar Netflix (borrador 1)

**Qué se ve:**
Jerson desliza la card de Netflix hacia la derecha. A partir de 20px:
- El fondo verde (`bg-success/10`) aparece con `opacity: 0..1` conforme avanza
- El icono `ThumbsUp` verde es visible
- La card se mueve con `drag="x"` framer-motion, `dragElastic={0.1}`

Al superar el 30% del ancho (umbral) y soltar:
- Haptic feedback `navigator.vibrate(20)`
- La card hace slide-out completo hacia la derecha (180ms `ease-out`)
- Las 2 cards restantes suben con animación `layout` de framer-motion (280ms)
- Optimistic UI: la aprobación se envía al backend en background
- Toast sobre tab-bar (3s): icono `CheckCircle2` verde + "Netflix aprobado. COP $47.900 registrado."
- Las 2 cards restantes quedan visibles

**Si la API falla:**
- La card vuelve a la lista con animación slide-in desde derecha
- Toast `variant="error"`: "No se pudo aprobar. Revisa tu conexión e inténtalo de nuevo."

**Transición:** Jerson ahora ve 2 borradores. Decide ver el detalle del de Mercado Libre.

---

### Paso 4: Tap — navegar al detalle del borrador 2 (Mercado Libre)

**Qué se ve:**
Jerson toca el centro de la card de Mercado Libre (no hace swipe). La navegación push lleva a `/m/finanzas/borrador/txn_2026_0527_002`.

**Pantalla de detalle (Borrador Detalle — Mockup 07):**
- Header: "Revisar borrador" con `← Volver` a izquierda y `Edit3` a derecha
- Card grande: Mercado Libre, carrito de compras icono rojo, monto "-COP $185.000" en `text-danger text-[2.5rem]`
- Fecha: "Martes 27 mayo 2026 · 21:53 p.m."
- Chips: "89% confianza IA" (ámbar), "Gmail"
- Sección Evidencia: snippet de email "Confirmamos tu compra de..." con el monto resaltado en verde

Jerson lee el snippet. Era la compra de un teclado mecánico. La categoría sugerida es "Compras" — correcto.

Jerson decide aproba pero quiere cambiar la categoría a "Equipamiento de trabajo". Toca "Cambiar" en la sección Clasificación IA.

**BottomSheet de categorías** aparece (altura inicial 60vh):
- Lista de categorías: Alimentación, Transporte, Suscripciones, Compras, Equipamiento de trabajo, Salud, Vivienda, Entretenimiento
- Checkmark junto a "Compras" (seleccionada)
- Jerson toca "Equipamiento de trabajo" → se marca y el sheet cierra en 280ms

**Estado actualizado en la pantalla de detalle:**
- Clasificación IA muestra "Equipamiento de trabajo" (cambiado manualmente)
- Badge de confianza cambia a "Edición manual"

Jerson toca "Aprobar" (botón primary verde full-width):
- Haptic `vibrate(20)`
- Spinner 600ms (API call)
- Toast: "Borrador aprobado. COP $185.000 registrado como Equipamiento de trabajo."
- Navegación automática hacia atrás (`pop`) con slide-left 280ms → vuelve al inbox

**Transición:** Inbox ahora muestra 1 borrador (el ingreso de J4).

---

### Paso 5: Swipe-rechazar ingreso (borrador 3)

**Qué se ve:**
Solo queda la card de ingreso de J4 (+COP $2.400.000). El inbox se ve limpio con una sola card.

Jerson no está seguro si el ingreso ya fue acreditado correctamente. Decide rechazar para revisarlo mañana.

Desliza la card hacia la **izquierda**. A partir de 20px:
- Fondo rojo (`bg-danger/10`) aparece gradualmente
- Icono `ThumbsDown` rojo visible a la izquierda

Al superar 30% del ancho:
- Haptic `vibrate(40)` (más fuerte para acción destructiva)
- Card hace slide-out hacia la izquierda 180ms
- El inbox queda **vacío**

**Empty state del Inbox:**
Aparece con fade-in 280ms:
- Ilustración `empty-finanzas-inbox.svg` (60% opacidad, 80px)
- Título `text-xl font-semibold text-text-primary`: "Todo al día"
- Subtítulo `text-sm text-tertiary`: "No hay borradores pendientes. El agente te avisará cuando detecte nuevos movimientos."
- Sin CTA (no hay acción posible — los borradores vienen solos)

Toast `variant="default"`: "Ingreso rechazado. No se registrará en tu historial."

**Transición al home:**

Jerson toca tab "Hablar" (Mic en tab-bar). Navega al home `/m/`.

**Estado del home post-flujo:**
- El saludo contextual ya no muestra "3 borradores": "Buenas noches, Jerson. Todo al día por esta noche."
- El Aura en `idle` violeta pulsante
- Los quick items ya no muestran el badge de borradores

El Aura reproduce (si audio habilitado): "Listo, Jerson. Los 3 borradores fueron procesados."

**Fin del flujo.**

---

## Notas de implementación para ambos flujos

### Gestión de estado (Zustand)
```ts
// store/finanzas.ts
interface FinanzasStore {
  drafts: DraftTransaction[];
  approveDraft: (id: string) => void;      // optimistic
  rejectDraft: (id: string) => void;       // optimistic
  updateCategory: (id: string, cat: string) => void;
  revertDraft: (id: string) => void;       // revert si API falla
}
```

### Background sync (offline)
Si el usuario aprueba con conexión intermitente:
1. Acción se encola en IndexedDB.
2. Service Worker con `Background Sync API` procesa cuando hay red.
3. La UI ya mostró el optimistic state; cuando el SW confirma, no hay cambio visual.

### Accesibilidad en swipe
Para usuarios de teclado o screen reader:
- `ArrowRight` en la card = aprobar
- `ArrowLeft` en la card = rechazar
- `Enter` = abrir detalle
- `aria-label` actualizado dinámicamente con la instrucción de teclado
