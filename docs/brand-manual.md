# Manual de Marca — NEXUS V2.0

> Guía de identidad visual para uso en marketing, producto y comunicación. Versión 1.0 — mayo 2026.

---

## 1. Esencia de marca

### Posicionamiento
NEXUS es el primer agente de IA personal que habla contigo, no solo escucha. Para profesionales latinoamericanos que quieren un asistente que gestione su vida digital con autonomía controlada — no una herramienta más que requiere aprendizaje.

**Tagline**: "Tu agente personal. Habla, actúa, aprende."

### Personalidad (5 atributos)
1. **Cercano** — tutea, usa el nombre del usuario, no es corporativo.
2. **Poderoso sin presumirlo** — la tecnología avanzada se siente simple.
3. **Confiable** — transparente con las decisiones que toma. Human-in-the-loop visible.
4. **Latinoamericano de raíz** — no es traducción del inglés. Es nativo en español neutro LATAM.
5. **Nocturno** — nace para usarse de noche, en contextos de trabajo intenso. El dark mode es su habitat natural.

### Lo que NO es NEXUS
- Un chatbot con opciones de menú.
- Una herramienta empresarial fría.
- Un producto "tech para techies" — el Aura y la voz lo hacen accesible a cualquier profesional.

---

## 2. Logo — concepto y construcción

### Concepto elegido: "Nodo orbital" (opción A)
Un círculo central con un anillo orbital elíptico inclinado, evocando un planeta o partícula cuántica. El centro sólido representa el núcleo de IA; el anillo, las conexiones que orbita (agentes, skills, conexiones).

```
Concepto ASCII:
         ___
    ____/   \____
   /    ●        \
  |               |
   \____       ___/
        \____/

Construcción formal:
  - Círculo interno: 40% del mark-width
  - Anillo elíptico: stroke 10% mark-width, rotación 25°
  - Proporción mark:logotype = 1:2.5
  - Font logotipo: Space Grotesk 600, tracking +0.08em
  - Texto: "NEXUS" en mayúsculas, no versalitas
```

### Opciones alternativas (para contextos sin el mark)
- **Opción B** (wordmark solo): "NEXUS" Space Grotesk 700, color accent.
- **Opción C** (monograma): letra "N" con un punto de accent en la esquina superior derecha del trazo.

### Márgenes de seguridad
El espacio de protección alrededor del logo = 50% de la altura del mark. Nunca colocar elementos a menos de esa distancia.

```
  ╔══════════════════════════╗
  ║                          ║
  ║    ⚬ NEXUS               ║  ← Area de protección
  ║                          ║
  ╚══════════════════════════╝
  Mínimo: área protección = 0.5× altura del mark
```

### Usos permitidos
- Sobre fondos `bg-base` (#07070A) — uso principal.
- Sobre fondos claros (#FAFAFB) — uso claro.
- Sobre gradientes oscuros de la paleta de marca.
- Logo en blanco sobre fondos oscuros (simplificado, monocromo).

### Usos prohibidos
- NO rotar el logo.
- NO aplicar sombras externas al logotipo.
- NO cambiar la tipografía.
- NO usar el logo en colores fuera de la paleta (`accent`, `white`, `text-primary`).
- NO estirar ni comprimir.
- NO aplicar efectos de degradado al texto del wordmark.

---

## 3. Paleta y tipografía — resumen rápido

### Paleta de marca (primarios)
| Color | Hex | Nombre | Cuándo |
|-------|-----|--------|--------|
| Violeta vivo | `#7C5CFF` | Accent | CTA, logo, foco |
| Negro profundo | `#07070A` | Base dark | Fondo app dark |
| Blanco frío | `#F4F4F7` | Texto primario | Titulares dark |
| Esmeralda | `#34D399` | Listening | Solo estado de voz |
| Ámbar | `#FBBF24` | Thinking | Solo estado de voz |
| Azul | `#3B82F6` | Speaking | Solo estado de voz |

Los colores de Aura (`esmeralda`, `ámbar`, `azul`) son de uso reservado para el componente conversacional. No usarlos en marketing genérico.

### Tipografía de marca
| Uso | Fuente | Peso |
|-----|--------|------|
| Display (hero, covers) | Space Grotesk | 700 |
| UI / cuerpo | Inter Variable | 400–600 |
| Datos / código | JetBrains Mono | 400 |

---

## 4. Tono de voz

### Principios
- **Tutear siempre**. Nunca "usted".
- **Conciso**. Si se puede decir en 5 palabras, no usar 10.
- **Usar el nombre**. "Jerson, tienes 3 borradores" > "Hay 3 borradores pendientes".
- **Sin jerga tech** en comunicación de usuario. "Tu agente detectó un cargo" > "El NLP pipeline clasificó una transacción".
- **Voz activa**. "El agente aprobó" > "La aprobación fue realizada".

### Ejemplos buenos vs malos

| Situación | Malo | Bueno |
|-----------|------|-------|
| Error de API | "Error 500: Internal Server Error" | "Algo no salió bien. Inténtalo en un momento." |
| Guardando | "Saving..." | "Guardando" |
| Vacío de transacciones | "No transactions found" | "No hay borradores pendientes. Cuando el agente detecte un cargo, aparecerá aquí." |
| Quota al límite | "You have reached your monthly limit" | "Llegaste al límite de tu plan este mes. Mejora a Pro para continuar." |
| Bienvenida onboarding | "Welcome to NEXUS! Let's get started." | "Hola Jerson. Tu agente personal está listo. Configúralo en 3 minutos." |
| Confirmación de aprobación | "Transaction approved successfully" | "Borrador aprobado. Registrado en tu historial." |

### Voz del asistente (Elisa María)
- Naturalidad sobre perfección.
- Entonación colombiana suave (neutral, no regional marcada).
- Pausas naturales. Sin frases robot.
- Velocidad: 1.0× por defecto. Usuario puede ajustar.

---

## 5. Do's & Don'ts visuales

### DO
- Usar el acento violeta en UN elemento por pantalla (el CTA o el estado activo).
- Dejar whitespace generoso. Las cards respiran.
- Comunicar estado con color (verde = ok, rojo = acción requerida, ámbar = pendiente).
- Iconos Lucide exclusivamente. Stroke uniforme 1.75px.
- Animaciones suaves <300ms con el easing de marca `cubic-bezier(0.2,0.8,0.2,1)`.
- Mantener el ratio de contraste WCAG AA (4.5:1 mínimo para texto).
- Tab-bar siempre visible en mobile (excepto pantallas de onboarding).

### DON'T
- Emojis en UI cromática. Solo en burbujas de chat conversacional.
- Gradientes de texto en UI funcional.
- Colores saturados en background completo (solo accent al 5–15% de opacidad).
- Borders gruesos (border-2 o más) en cards normales.
- Múltiples colores semánticos simultáneos en el mismo viewport (máx 2).
- Fondos blancos puro en modo dark (siempre usar `bg-surface` #101015, no #FFFFFF).
- Tipografía `font-light` (300) — demasiado delgada en AMOLED.
- Mezclar Heroicons con Lucide en la misma pantalla.

---

## 6. Templates de identidad aplicada

### App icon (512×512)
Fondo: `radial-gradient(circle at 40% 35%, #7C5CFF 0%, #3A1E99 100%)`
Elemento: Logo mark (nodo orbital) en blanco al 90% centrado, escala 60% del ícono.
Radio de esquinas: 22% del tamaño (Apple HIG compliant).

### Avatar de la app (notificaciones, PWA install banner)
Misma composición que el app icon en 192×192 y 512×512 (PWA manifest standard).

### Social media post (1080×1080 Instagram)
- Fondo: `#07070A`
- Logo NEXUS en esquina superior izquierda, pequeño
- Elemento visual central: screenshot de la app o ilustración line-art
- Texto sobre fondo: Space Grotesk 700, máx 2 líneas, color `#F4F4F7`
- Accent strip: línea de 4px `#7C5CFF` en borde inferior
- Sin emojis. Sin textura de ruido excesivo.

### Signature de email
```
──────────────────────────────
⚬ NEXUS · [nombre del remitente]
Tu agente personal | nexus.j4smartsolutions.com
J4 Smart Solutions · Bogotá, Colombia
──────────────────────────────
```
Fuente: Inter 13px. Separadores en `--border-subtle`. Link en accent.

### Slide deck cover (presentación a inversores)
- Fondo degradado: `#07070A` → `#0F0A1E` (izquierda a derecha)
- Aura visualizer (versión estática del SVG) como elemento visual derecho, 40% del ancho
- Título: Space Grotesk 700, blanco, 48pt
- Tagline: Inter 400, `#A8A8B8`, 24pt
- Logo en esquina inferior derecha
- Nunca usar fondo blanco en slides de marca.

---

## 7. Coherencia cross-product

### J4 Smart Solutions como paraguas de marca
NEXUS es el producto flagship de J4. El sub-branding sigue este patrón:
- **NEXUS** — agente personal (violeta `#7C5CFF`)
- **Amparo** — legaltech (azul judicial `#2563EB`)
- **Ariadna** — fiscal (verde esmeralda `#059669`)
- **Aleteia** — gestión organizacional (naranja ámbar `#D97706`)

Todos comparten: Inter/Space Grotesk, Lucide, dark mode, border-radius system y el principio de cero emojis en UI.

La coherencia entre productos aumenta el capital de marca de J4 como empresa de IA de calidad enterprise.
