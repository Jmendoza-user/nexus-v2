# NEXUS V2.0 — Índice de documentación de diseño

> **Actualizado 28-may-2026** tras recibir el diseño definitivo del diseñador externo.

## 🚨 Lee primero

1. **[DESIGN-CANON.md](DESIGN-CANON.md)** — **Decreto canónico**: el sistema visual del diseñador externo es la verdad única. Reglas para todo el equipo.
2. **[design-brief.md](design-brief.md)** — Brief funcional original aprobado por Jerson (qué pantallas, qué microcopy, qué patrones, qué accesibilidad). Sigue vigente como contrato de FEATURES; el sistema VISUAL lo dicta el diseñador externo.

## 🎨 Sistema visual canónico

**[designer-external/nexus/](designer-external/nexus/)** — Prototipo HTML/JSX entregado por el diseñador externo. Aprobado por Jerson "al pie de la letra".

- `styles/tokens.css` — tokens definitivos (dark + light mirror).
- `styles/components.css` — estilos de componentes base.
- `app/ui.jsx` — 17 primitivas React (Btn, IconBtn, Chip, ListRow, Sheet, Toast, etc.).
- `app/icons.jsx` — set Lucide inline (stroke 1.75, currentColor).
- `app/aura.jsx` — Aura visualizer (orbital radial + esfera).
- `app/screen_*.jsx` — 7 archivos con pantallas de referencia (home, finanzas, proyectos, vault, cuenta, onboarding, misc).
- `app/data.js` — mock data con helpers (`NX.fmtCOP`, `NX.drafts`, etc.).
- `Nexus Prototype.html` — entrypoint navegable del prototipo completo.
- `_shots/*.png` — capturas para validación pixel-perfect.

## 📐 Documentos complementarios (vigentes)

- **[brand-manual.md](brand-manual.md)** — Manual de marca corto (3 conceptos de logo, esencia, tono de voz). Pendiente validación final del logo por Jerson.
- **[aura-spec.md](aura-spec.md)** — Especificación técnica del Aura visualizer. **Reconciliar con la implementación del diseñador externo (`designer-external/nexus/app/aura.jsx`)**: si diverge, gana el diseñador externo.
- **[prototype-flows.md](prototype-flows.md)** — Flujos navegables narrados (onboarding 8 pasos + aprobar 3 borradores). Compatible con el sistema canónico.
- **[illustrations/](illustrations/)** — 8 ilustraciones SVG line-art `currentColor` para empty states. Compatibles con el sistema canónico.

## 📦 Archivo (no usar, conservar)

**[_apolo-archive/](_apolo-archive/)** — Output de APOLO descartado por conflicto con el sistema canónico:
- `mockups/` — 16 mockups TSX en Tailwind v4 (reemplazados por `designer-external/nexus/app/screen_*.jsx`).
- `components/` — 10 archivos de componentes Tailwind (reemplazados por `designer-external/nexus/app/ui.jsx`).
- `design-system.md` — sistema de tokens en formato Tailwind `@theme` (reemplazado por `designer-external/nexus/styles/tokens.css`).

## ⚠️ Decisiones pendientes de Jerson antes de Hito 0

1. **Logo definitivo** (3 conceptos propuestos en `brand-manual.md`).
2. **Precios upgrade**: confirmar Pro $45.000 COP/mes y Team $120.000 COP/mes o ajustar.
3. **Catálogo público de agentes base** (3 que ve el user nuevo en onboarding).
4. **Editor del vault**: TipTap vs Lexical (recomendado por APOLO por budget).
5. **OAuth Gmail/GCal/Telegram**: directo a proveedores con callback al backend, o proxy OAuth de J4.
