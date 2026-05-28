# Plan — NEXUS V2.0 (Reforma & Comercialización)

## Contexto

NEXUS V1 (`/root/nexus/`) es la plataforma de gestión de agentes de J4 Smart Solutions. Funciona en producción (`metis.j4smartsolutions.com`, PM2 `nexus` puerto 3100) pero **es monousuario** (Jerson) y está cerrado a uso interno. El PRD V2.0 (recibido por Telegram, almacenado en `/root/.claude/debug/telegram/inbox/1779991656664-AgADygkAAiL4yUQ.md`) pide convertirlo en **producto SaaS B2C/B2B** con:

- Aislamiento total por usuario (filesystem + DB).
- Motor financiero Human-in-the-Loop con detección Gmail OAuth y aprobación manual de borradores.
- Obsidian Vault por usuario con plantillas y RAG.
- Agente autónomo autocurativo (repara errores de skills/MCPs sin mostrarlos al usuario).
- Capacidades VPS exclusivas (Playwright headless, OCR local, monitoreo cron, Token Guard anti-PII).
- Mobile-First (PWA) con voz nativa ElevenLabs y bot único Telegram con vinculación por código.
- Comercialización con planes Free (OpenCode API) + Pro/Team (Claude API/CLI), pagos vía MercadoPago.

**Resultado esperado**: producto pulido en **22 semanas (~5 meses)**, sin atajos MVP, listo para venta pública. Jerson migrado como `user_001` desde día 1.

## Decisiones cerradas con el usuario

| Tema | Decisión |
|------|----------|
| Stack backend | Conservar **Node 22 + Express 5 + Drizzle + PostgreSQL**. Workers **Python (FastAPI)** solo para OCR, Playwright, NER y embeddings. |
| Modelo comercial | **B2C primero** (Free + Pro + Team), B2B después. Free usa **OpenCode hosted API** (no Claude). |
| Sandboxing | **Aislamiento lógico**: filesystem por user en `/root/nexus-v2/data/users/user_NNN_env/` + columna `user_id`/`org_id` en todas las tablas. Sin Docker por usuario. |
| Costos IA | **J4 paga** en tiers pagos. Cupos por plan, MercadoPago como gateway. |
| Migración Jerson | Script convierte su setup actual en `user_001` (agentes, projects, issues, vault, IG, calendar). Caso de prueba real durante todo el desarrollo. |
| Onboarding | Vault con plantillas precargadas + **roster de 3 agentes base** (Asistente Principal, Curador Vault, Curador Finanzas) al registrarse. |
| Telegram | **Bot único** `@NexusJ4Bot` con vinculación por código de 6 chars. |
| Plataforma | **Mobile-First (PWA `/m/*`)** rediseñado en profundidad; desktop hereda componentes responsive. |
| Workspace | **`/root/nexus-v2/`** paralelo al actual; swap al final (V1 a `nexus-v1-archive`). Datos aislados en `/root/nexus-v2/data/users/`. |

## Arquitectura técnica

### Capas

```
PWA Mobile-First /m/*  ─┐
Desktop SPA /app/*      ├─→  Edge (Nginx Proxy Manager + TLS)
Telegram Bot único      ─┘                │
                                          ▼
                       ┌──────────────────────────────────────────┐
                       │  BACKEND NODE (Express 5, puerto 3100)   │
                       │  middlewares: authJwt → tenantContext    │
                       │                → quotaCheck → router     │
                       │  AgentRunner (adapters Claude/OpenCode)  │
                       │  TokenGuard · VaultIndexer · GmailSync   │
                       │  HeartbeatEngine · RoutineScheduler      │
                       └──┬───────────────────────┬───────────────┘
                          │ HTTP loopback         │ fs + spawn
                          ▼                       ▼
              ┌────────────────────┐    ┌──────────────────────────┐
              │ WORKERS PYTHON     │    │ FILESYSTEM AISLADO        │
              │ FastAPI 127.0.0.1: │    │ /root/nexus-v2/data/users/│
              │ 7001               │    │   user_NNN_env/           │
              │ /ocr /scrape /ner  │    │     skills/ mcp/ vault/   │
              │ /embed /pdf-extract│    │     connections/ workdir/ │
              │ Modelos en memoria │    │     runs/ uploads/        │
              └────────────────────┘    │ Permisos 0750             │
                                        └──────────────────────────┘
              ┌────────────────────────────────────────────────────┐
              │ POSTGRES 16 (multi-tenant single DB) + pgvector    │
              │ Redis 7 (BullMQ colas + caché semántico)           │
              └────────────────────────────────────────────────────┘
```

### Estructura por usuario (`/root/nexus-v2/data/users/user_NNN_env/`)

```
.meta.json              # {userId, orgId, tier, createdAt}
skills/                 # *.md instalados por user (custom o desde registry)
mcp/                    # .mcp.json y configs MCP del user
connections/            # tokens cifrados AES-256-GCM (gmail.enc, gcal.enc, ...)
vault/                  # Obsidian del user (Preferencias.md, Diarios/, Conceptos/)
  .index/               # backup local del índice vectorial
workdir/                # cwd para spawn de Claude CLI (única ruta expuesta vía --add-dir)
runs/                   # stdout/stderr por run, formato stream-json
uploads/                # PDFs, fotos, audios subidos
```

### Spawn aislado de IA

`AgentRunner.run(userId, agentId, prompt)` resuelve `userPaths`, `tier`, `adapter`:

- **Free** → `OpencodeAdapter` (HTTPS a OpenCode hosted, modelo `mimo-v2.5-pro`).
- **Pro/Team con `claude-api`** → llamadas directas a Anthropic API (default para chat).
- **Pro/Team con `claude-cli`** → spawn `claude` con `cwd = userPaths.workdir`, `HOME = userPaths.root`, `CLAUDE_CONFIG_DIR = userPaths.root/.claude`, `--add-dir workdir`, `--add-dir vault`, `--disallowedTools` para acciones destructivas en Free/Pro.

`PromptGuard` envuelve cada prompt con `TokenGuard.redact()` antes de la IA y `restore()` después.

### Migración Jerson → `user_001`

Script `backend/src/migrations/scripts/001_jerson_to_user.ts` (idempotente, `--dry-run` / `--execute` / `--rollback`):

1. Crea `organizations` "J4 Smart Solutions" (`slug=j4`, `tier=team`) y `users` Jerson (`email=jersonmendoza@eyesa.com.co`, hash desde `.auth.json`).
2. `mkdir /root/nexus-v2/data/users/user_000001_env/{skills,mcp,connections,vault,workdir,runs,uploads}` con permisos 0750.
3. Copia: `/root/obsidian-vault/* → vault/`, skills personales → `skills/`, credenciales IG/Calendar cifradas → `connections/`.
4. `UPDATE` masivo añadiendo `user_id, org_id` a todas las tablas V1 (agents, projects, issues, routines, publications, etc.).
5. Backfill Pluto JSON → tabla canónica `transactions` con `estado='Confirmado'`, `canal_origen='Manual'`.
6. Verificación: `SELECT count(*) WHERE user_id IS NULL` = 0 en todas las tablas.

## Schema multi-tenant (nuevas tablas)

Inglés (coherencia con V1). Las **modificaciones a tablas existentes** añaden `user_id UUID NOT NULL` + `org_id UUID NOT NULL` con FKs e índices `(user_id, created_at DESC)`. RLS de Postgres NO se activa; en su lugar helper ORM `tenantScoped(db, userId)` + linter ESLint custom que prohíbe `db.select().from()` directo fuera de `services/admin/*`.

**Tablas nuevas críticas** (ver detalle de columnas en spec ampliado, sección 2 del plan técnico devuelto por agente Plan):

- **Tenancy**: `organizations`, `users`, `org_members`, `user_settings`.
- **Billing**: `subscriptions` (provider=mercadopago), `usage_quotas` (org_id+period+metric), `billing_events`.
- **Finanzas canónica**: `transactions` (id UUID, fecha_hora, monto, currency, tipo enum `Egreso|Ingreso|Inversion|Deuda`, categoria, comercio_origen, canal_origen enum `Gmail|OCR|Manual|Sync`, estado enum `Borrador|Confirmado|Rechazado`, legitimo, evidence_id), `gmail_oauth_tokens`, `transaction_email_evidence`.
- **Skills & Connections**: `skill_installations`, `connections` (provider, status, secret_ref → ruta en `connections/`).
- **Autocure**: `agent_repair_attempts` (run_id, attempt_num, error_class, diagnosis, action JSON, outcome).
- **Vault RAG**: `vault_chunks` con `embedding vector(384)` y HNSW index (extensión `pgvector`).
- **Telegram**: `telegram_pairings` (código 6 chars, expires_at).
- **Notifications**: `notifications` (channel: telegram|inapp|email).

## Mapa de módulos (15)

| # | Módulo | API representativa | UI PWA | Worker Python |
|---|--------|---------------------|--------|----------------|
| 1 | Auth & Tenancy | `/api/auth/*`, `/me`, `/telegram/pair` | `/m/login`, `/m/onboarding/*` | — |
| 2 | Billing & Quotas | `/billing/{plan,checkout,webhook/mp}` | `/m/cuenta`, `/m/upgrade` | — |
| 3 | Vault & RAG | `/vault/*`, `/vault/rag/query` | `/m/vault` | `/embed` |
| 4 | Agents core MT | `/agents/*`, `WS /agents/:id/stream` | `/m/agentes` | — |
| 5 | Asistente voz+chat | `/assistant/chat`, `/voice/*` | `/m/` (mic central) | — |
| 6 | Skills & MCPs | `/skills/*`, `/mcp/*/install` | `/m/config/{skills,mcp}` | — |
| 7 | Autocure | interno `runWithRepair()` | indicador en agente | — |
| 8 | Connections OAuth | `/connections/:p/oauth/{start,callback}` | `/m/config/conexiones` | — |
| 9 | Motor Finanzas | `/finanzas/{summary,transactions}` + approve/reject | `/m/finanzas` (Resumen / Inbox / Historial) | `/ocr` |
| 10 | Projects/Issues/Routines MT | reuso V1 con filtro `user_id` | `/m/proyectos`, `/m/rutinas` | — |
| 11 | Telegram bot | `/tg/webhook`, `/tg/notify` | banner pairing en `/m/cuenta` | — |
| 12 | Playwright scraping | `/scrape/run` (Pro+) | `/m/herramientas/scrape` | `/scrape` |
| 13 | OCR pipeline | `/upload/receipt` → cola → Borrador | botón en `/m/finanzas` | `/ocr`, `/pdf-extract` |
| 14 | Token Guard | interceptor + `/security/redactions` | toggle en `/m/config/seguridad` | `/ner-redact` |
| 15 | Desktop SPA Pro | reusa `/api/*` | `/app/*` | — |

## Fases de entrega (22 semanas)

### Hito 0 — Foundation (sem 1–3)
**Objetivo**: workspace listo, schema multi-tenant, Jerson migrado, login multiuser, no-leak tests pasan.
- Monorepo `npm workspaces` (backend, frontend, mobile, workers-py, shared).
- BD `nexus_v2` con migraciones 0001–0010, `tenantScoped()` helper + linter.
- Auth (signup, login, JWT cookie, sessions), middleware tenancy, PWA `/m/login` + `/m/onboarding/*`.
- Script `001_jerson_to_user.ts` ejecuta sin errores; `tests/tenancy/no-leak.spec.ts` verde.

### Hito 1 — Vault + Agentes + Asistente Principal (sem 4–8)
**Objetivo**: vault por user con plantillas + RAG, AgentRunner con adapters, voz E2E, Telegram pairing.
- `VaultIndexer` con worker `/embed` y `vault_chunks` HNSW.
- AgentRunner + `pickAdapter(tier, agent.adapterType)`, tabla `tier_policies` semilla.
- `/api/voice/*` por user con voz seleccionable; `/m/` con mic central (Whisper → LLM → ElevenLabs).
- Onboarding crea vault con plantillas (`Preferencias.md`, `Aprendizajes_Repetitivos.md`, `Diarios/`, `Conceptos/`) y 3 agentes base.
- Bot `@NexusJ4Bot` con `/start` + código de vinculación.

### Hito 2 — Skills, MCPs, Connections, Autocure (sem 9–12)
**Objetivo**: panel de configuración completo + agente que se autocura.
- Pantallas `/m/config/{agentes,skills,mcp,principal,formatos,conexiones}`.
- Instalador de skills con `skill_installations`; OAuth Gmail+GCal+Meta por user con secretos en `connections/*.enc`.
- Loop autocure (`AgentRunner.runWithRepair()`): detecta fallos por patrones de output, llama a "Reparador" (Claude/OpenCode) para diagnóstico+acción JSON, ejecuta y reintenta hasta 3 veces; loguea cada intento.

### Hito 3 — Motor Financiero completo (sem 13–16)
**Objetivo**: borrador→aprobación operativo con Gmail + OCR.
- `GmailSync` cron 15min por user; query `from:(banco|davivienda|nequi|bbva|bancolombia|...)`; clasificador IA extrae `tipo/monto/comercio/categoria` con `confidence`; inserta Borrador con `evidence_id`.
- Pantalla `/m/finanzas` con tabs (Resumen | Inbox Borradores | Historial) y swipe aprobar/rechazar.
- Upload foto/PDF factura → worker `/ocr` (Tesseract) + `/pdf-extract` (Docling) → mismo flujo Borrador.
- Backfill Pluto JSON para Jerson.

### Hito 4 — VPS exclusivas + Token Guard + Observabilidad (sem 17–19)
**Objetivo**: scraping headless, monitoreo cron, anti-PII, dashboard de uso.
- Worker `/scrape` con Playwright pool; módulo monitor (rutina "vigilar X en Y portal", notifica Telegram al detectar cambio).
- TokenGuard 3 etapas (regex local → spaCy NER worker → caché semántico Redis).
- Dashboard `/m/uso` (tokens, mensajes, $ahorrado por caché, alertas en 80% de quota).

### Hito 5 — Polish + Billing + Desktop + Launch (sem 20–22)
**Objetivo**: producto listo para venta.
- MercadoPago checkout + webhook activa tier; tier downgrade automático al expirar.
- Rediseño PWA pulido (gestos, dark/light, WCAG AA, animaciones).
- Desktop SPA `/app/*`: vault editor avanzado, kanban issues, finanzas con gráficos.
- Carga 50 VUs con k6, e2e Playwright completo, runbook ops.
- **Swap**: `mv /root/nexus /root/nexus-v1-archive && mv /root/nexus-v2 /root/nexus && pm2 restart nexus`. V1 queda parado 7 días para rollback.

## Decisiones técnicas clave

- **Routing IA por tier**: tabla `tier_policies` (semilla, no editable). Si tier free pide `claude-cli`, downgrade silencioso a `opencode:mimo-v2.5-pro` con log `tier_downgrade`. Pro/Team default = Claude API (más barato y predecible que CLI); CLI solo para heartbeat / agentes autónomos largos.
- **Sandboxing**: aislamiento lógico (no Docker/setuid). Defensa en profundidad: TokenGuard + path validation (`path.resolve().startsWith(userPaths.root)`) + `--add-dir` restringido + `--disallowedTools` en Free/Pro. Bubblewrap/Firejail queda como add-on enterprise futuro.
- **Vault vectorial**: **pgvector** (no Chroma ni SQLite-vss). Modelo embeddings `sentence-transformers/all-MiniLM-L6-v2` (384 dim, multilenguaje). HNSW index.
- **Autocure**: máx 3 reintentos por run; logged en `agent_repair_attempts`; al agotarse abre issue automático y mensaje conversacional al user.
- **Token Guard pipeline**: regex local (rápido, siempre) → spaCy NER (solo Pro+, prompts >500 chars) → Redis caché semántico con embeddings cortos (similaridad coseno ≥0.95 → reuso).
- **Quota enforcement**: middleware `quotaCheck(metric, costFn)` antes de routers caros; 402 con `upgradeUrl` al exceder; reset cron `0 0 1 * *`; quota nivel `org_id` con sublímite opcional `user_id`.

## Riesgos top 5

| # | Riesgo | Prob | Impacto | Mitigación |
|---|--------|------|---------|-----------|
| 1 | Costo IA descontrolado en Pro/Team | Alta | Alto | Quotas duras + alerta 80% + circuit breaker al 2x budget. TokenGuard caché ~30%. |
| 2 | Fuga cross-tenant por olvido de `where(user_id)` | Media | Crítico | Linter ESLint custom + suite `tests/tenancy/no-leak.spec.ts` permanente en CI. |
| 3 | OpenCode hosted lento/caído (Free inutilizable) | Media | Alto | Fallback automático a Claude Haiku con budget mínimo tras 3 timeouts >5s. |
| 4 | OAuth Gmail bloqueado por verificación Google CASA | Media | Alto | Iniciar verificación sem 9; whitelist de testers; fallback IMAP/App Password documentado. |
| 5 | Swap V1→V2 rompe a Jerson | Baja | Crítico | Doble `pg_dump` + `rsync` snapshot vault. V2 en sombra en puerto 3101 una semana. V1 parado 7 días post-swap. |

## Verificación

### Por hito
- **H0**: `npm run test:tenancy` (2 users seed, asserts cross-endpoint) + migración Jerson `--dry-run` con diff conteos.
- **H1**: Playwright `vault-rag.spec.ts` (sube nota → query RAG → cita real), `voice-roundtrip.spec.ts` (<8s), `tier-routing.spec.ts` (free no logra Claude CLI).
- **H2**: `autocure.spec.ts` (borrar skill → agente reinstala y completa), OAuth Gmail con sandbox de Google.
- **H3**: `finanzas-flow.spec.ts` (mock IMAP → correo banco → Borrador → swipe aprobar → summary actualizado), fixture OCR 10 tirillas ≥85% precisión.
- **H4**: scraping fixture (página estática local) → notif Telegram; TokenGuard fixture 100 prompts → 0 fugas PII.
- **H5**: k6 50 VUs × 5min → P95 <3s sin OOM; MP sandbox → activación tier <30s.

### Test maestro permanente — `tests/tenancy/no-leak.spec.ts`
Seed: user A (org A, free) + user B (org B, pro), cada uno con 3 agents, 5 issues, 10 notas, 5 transactions.
1. Para cada endpoint público GET listante: login A, response no contiene ningún ID de B (y viceversa).
2. Para cada endpoint mutativo: A intenta `PATCH /agents/<id-de-B>` → 404 (no 403, para no revelar existencia).
3. Path traversal en `note_path`: `../../../user_000002_env/vault/` → bloqueado.
4. Stress 20 runs paralelos por user → ningún `runs/*.log` cruza directorios; `HOME` aisló `~/.claude` por usuario.

### Métricas de éxito globales (dashboard `/admin/metrics`)
- Onboarding (signup → primer mensaje IA): mediana <90s.
- Adopción Telegram: ≥40% users vinculan.
- Precisión Borradores Gmail: ≥90% aprobados sin edición.
- Costo IA por user activo/mes (Pro): <$5 USD.
- Uptime backend: 99.5% mensual.

## Archivos clave a reutilizar de V1

- `/root/nexus/src/db/schema.ts` — base para schema V2 (añadir multi-tenancy).
- `/root/nexus/src/auth.ts` — referencia, reemplazar singleton por tabla `users`.
- `/root/nexus/src/agent/AgentSession.ts` — base para `ClaudeCliAdapter` (parametrizar paths por user).
- `/root/nexus/src/heartbeat.ts` — motor de ejecución, agregar `user_id` en runs.
- `/root/nexus/src/routes/voiceRouter.ts` — voz E2E ya operativa, parametrizar voz por user.
- `/root/nexus/src/routes/nexus-api.ts` (vault endpoints) — base para vault multi-user.
- `/root/nexus/src/services/instagram/*` — flujo de aprobación que sirve de patrón para "Borrador → Aprobado" en finanzas.
- `/root/nexus/src/services/google/oauth-bootstrap.ts` + `crypto.ts` — patrón OAuth con tokens cifrados, extender a Gmail.
- `/root/nexus/src/routine-scheduler.ts` — cron evaluator reutilizable para `GmailSync` y monitores.

## Próximo paso

Al aprobar este plan:
1. **Exportar la sección "Brief de Diseño UI/UX Mobile-First"** (más abajo) a `/root/nexus-v2/docs/design-brief.md` como documento independiente que será el input del agente de diseño.
2. Invocar al agente de diseño especialista (APOLO o similar con skills `ui-ux-pro-max` + `efecto-web-design`) para que produzca el sistema de diseño completo, mockups de las pantallas críticas y la librería de componentes React.
3. Tras aprobar el diseño, invocar **writing-plans** para desglosar Hito 0 (Foundation) en plan de implementación granular antes de tocar código.

---

# Brief de Diseño UI/UX Mobile-First — NEXUS V2.0

> Este documento es el **input completo para el agente de diseño**. Al ser exportado como archivo independiente (`/root/nexus-v2/docs/design-brief.md`), debe poder leerse sin contexto adicional. Repite lo necesario del plan principal para que sea autosuficiente.

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

## 2. Filosofía y principios de diseño

1. **Conversational-first, no chat-only**: la voz es la entrada principal en mobile. El usuario habla, el agente responde con voz natural (ElevenLabs Elisa María) + tarjeta visual con acción. Chat texto es respaldo, no protagonista.
2. **Human-in-the-Loop visible**: cuando la IA toma decisiones que afectan dinero o datos sensibles, **siempre hay aprobación humana explícita**. Las tarjetas de "Borrador" tienen acciones primarias claras (swipe-aprobar, swipe-rechazar).
3. **Cero emojis en UI cromática**: usar **lucide-react** (stroke uniforme, `currentColor`). Emojis solo en chat conversacional cuando el agente responde. Consistente con preferencia documentada de Jerson.
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
Espejo simétrico (Jerson decidirá si entra en MVP o en H5 polish). Tokens equivalentes con `--bg-base: #FAFAFB`, `--text-primary: #0A0A12`, accent mantiene `#7C5CFF`.

### 3.3 Tipografía
- **Sans (UI)**: `Inter` (variable) — pesos 400/500/600/700.
- **Display (titulares hero)**: `Space Grotesk` 500/700 — opcional, solo en onboarding y landing.
- **Mono (códigos, IDs, debug)**: `JetBrains Mono` 400/500.
- Escala (rem, base 16):

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
Solo en modo claro. En modo oscuro: usar `--bg-elevated` + `--border-subtle`.
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

## 5. Inventario de pantallas (con descripción de propósito)

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
     - Tap → abre `/m/finanzas/borrador/:txId` con detalle + evidencia (snippet del correo, link a Gmail).
   - **Tab Resumen**: gráfico de barras semanal (ingresos vs egresos), top 5 categorías del mes, próximos pagos automáticos.
   - **Tab Historial**: lista cronológica con filtros (rango fecha, tipo, categoría, canal).

4. **`/m/vault` — Segundo cerebro**
   - Header: "Vault" + buscador prominente con autocompletar de notas y conceptos.
   - Vista por defecto: **mosaic de tarjetas recientes** (3 columnas en tablet, 2 en mobile, 1 en mobile pequeño con orientación `auto-fit`).
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
| **Swipe horizontal en card** | Borradores financieros, tareas | Derecha = positivo (aprobar/completar), izquierda = negativo (rechazar/archivar). Threshold 30% del ancho. Haptic feedback (`navigator.vibrate(20)` en Android, `Haptics.impactOccurred('light')` en iOS PWA si disponible). |
| **Bottom sheet** | Crear, editar, filtrar, ver detalle ligero | Altura inicial ~60% viewport, drag-to-expand a 95%, drag-to-dismiss. `border-radius` 20px en top corners. Backdrop con `bg-black/40 + backdrop-blur-sm`. |
| **Long-press en mic** | Cambiar a modo texto | Muestra teclado y caja de texto inline en lugar de escucha. |
| **Pull-to-refresh** | Listas (proyectos, vault, historial finanzas) | Spinner custom con accent color. |
| **Optimistic UI** | Aprobar borrador, completar tarea, agregar nota | Cambio visual inmediato + revert si la API falla con toast de error. |
| **Skeleton loaders** | Carga inicial de listas | Shimmer sutil 1.2s loop, sin spinners salvo en sheets de acción. |
| **Empty states** | Cualquier lista vacía | Ilustración minimal (line icon Lucide grande + 60% opacidad), título amable, CTA primario. NUNCA dejar pantalla en blanco. |
| **Toasts** | Confirmaciones, errores leves | Aparecen abajo (sobre tab-bar), 3s autodismiss, tap para cerrar antes. Posición no bloquea mic. |
| **Confirm dialogs** | Acciones destructivas | Modal centrado pequeño, 2 botones (cancelar secundario, confirmar destructive). Para borrado de cuenta: confirmación por escritura de palabra. |

## 7. Componentes clave (lista exhaustiva para sistema de diseño)

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

1. **Sistema de diseño completo** documentado en archivo `/root/nexus-v2/docs/design-system.md` con tokens implementables (variables CSS + Tailwind config).
2. **Mockups de las 16 pantallas principales** en alta fidelidad (preferentemente Figma exportado o equivalente; alternativa: componentes React funcionales con datos mock).
3. **Librería de componentes React** en `/root/nexus-v2/frontend-mobile/src/ui/` con TypeScript, props tipadas, stories de Storybook opcionales.
4. **Set de ilustraciones** para empty states (8-10 ilustraciones line-art coherentes con la marca).
5. **Especificación de animaciones** del Aura visualizer (canvas, parámetros, código de referencia).
6. **Manual de marca corto**: logo, paleta, tipografía, do/don'ts (≤8 páginas) para uso en marketing.
7. **Prototipo navegable** (Figma prototype o React deployed) del flujo onboarding completo y del flujo "aprobar 3 borradores financieros".

## 15. Referencias visuales sugeridas (mood board)

- **Linear** (densidad informativa controlada, dark mode pulido, palette violeta).
- **Things 3** (jerarquía suave, tipografía generosa, micro-interacciones).
- **Cash App** (UI financiera mobile-first, swipe actions, color confidence).
- **Granola** (PWA conversacional con captura de voz elegante).
- **Mem.ai / Reflect** (segundo cerebro UX con backlinks visibles).
- **Replit Mobile** (agente IA en mobile, chat + actions panel).

> Fin del Brief de Diseño. Este documento es autosuficiente para que un agente de diseño produzca el sistema completo. Cualquier ajuste de prioridades por hito se coordina con el plan de implementación general.
