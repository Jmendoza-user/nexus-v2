# @nexus/backend — NEXUS V2.0 (Hito 0: Foundation multi-tenant)

Backend Node + Express 5 + Drizzle + PostgreSQL. Esta entrega cubre el **núcleo
multi-tenant**: schema de tenancy, auth multiusuario, aislamiento por usuario
(DB + filesystem) y suite de tests anti-fuga. NO incluye migración de datos de
Jerson ni módulos de hitos posteriores (MercadoPago, Gmail, voz, vault RAG,
autocure, adapters Claude/OpenCode).

## Stack

- Node 22+ (probado en Node 25), Express 5, TypeScript (ESM).
- Drizzle ORM sobre `pg` (node-postgres Pool).
- PostgreSQL 16 con extensiones `citext`, `pgcrypto`, `vector` (pgvector).
- `bcryptjs` (hash), `jsonwebtoken` (sesión), `cookie-parser`, `zod` (validación).
- Tests: `vitest` + `supertest`.

## Base de datos

DB dedicada **`nexus_v2`** (NO la de Amparo ni la de V1). Owner `nexus_user`.
Extensiones habilitadas por superusuario al crearla.

```
DATABASE_URL=postgres://nexus_user:nexus_j4_2026@127.0.0.1:5432/nexus_v2
```

## Estructura

```
backend/
├── drizzle/                      # migraciones SQL generadas por drizzle-kit
│   └── 0000_*.sql
├── src/
│   ├── app.ts                    # construye la app Express (sin escuchar) — usada por tests
│   ├── server.ts                 # entry point (listen :3110, graceful shutdown)
│   ├── lib/
│   │   ├── env.ts                # config tipada + validación fail-fast
│   │   ├── crypto.ts             # AES-256-GCM para secretos de connections
│   │   └── jwt.ts                # sign/verify JWT + cookie de sesión httpOnly
│   ├── db/
│   │   ├── schema.ts             # schema multi-tenant (Drizzle, inglés)
│   │   ├── index.ts              # Pool + drizzle()
│   │   ├── tenant.ts             # tenantScoped(userId) — política de aislamiento
│   │   ├── migrate.ts            # aplica migraciones (npm run db:migrate)
│   │   └── seed.ts               # 2 users de prueba (A free / B pro) + dominio
│   ├── middleware/
│   │   ├── auth.ts               # authJwt: cookie → req.user
│   │   └── tenant.ts             # tenantContext: req.tenant; quotaCheck (stub)
│   ├── services/
│   │   ├── auth.ts               # register / login / me
│   │   └── userEnv.ts            # aislamiento filesystem + path-traversal guard
│   └── routes/
│       ├── auth.ts               # /api/auth/{register,login,logout,me}
│       └── agents.ts             # /api/agents (CRUD scoped) — prueba de tenancy
└── tests/
    ├── helpers.ts
    ├── auth.spec.ts              # flujo register→login→me→logout
    └── tenancy/no-leak.spec.ts   # test maestro anti-fuga cross-tenant
```

## Comandos

```bash
# Instalar
npm install

# Migraciones
npm run db:generate     # genera SQL desde schema.ts (drizzle-kit)
npm run db:migrate      # aplica migraciones a nexus_v2

# Datos de prueba
npm run db:seed         # crea user A (free) y B (pro) con dominio + envs

# Arranque
npm run dev             # tsx watch, escucha en :3110
npm run build && npm start

# Tests
npm test                # toda la suite (vitest run)
npm run test:tenancy    # solo tests/tenancy
```

Health: `GET http://127.0.0.1:3110/api/health`.

## Política de aislamiento — REGLA DE ORO

> **Todo acceso a tablas con `user_id` pasa por `tenantScoped(userId)`.**
> Ningún handler fuera de `services/admin/*` debe ejecutar
> `db.select().from(tabla)` directo sobre una tabla de dominio.

`src/db/tenant.ts` expone `tenantScoped(userId)` con métodos `list / find /
insert / update / remove` que **siempre** inyectan `where(eq(table.userId,
userId))`:

- `list(table)` → solo filas del tenant (ordena por `created_at desc`).
- `find(table, id)` → fila por id **AND** user_id, o `null`.
- `insert(table, values)` → fuerza `user_id` del tenant.
- `update(table, id, patch)` → filtra por (id AND user_id); **nunca** permite
  reasignar `user_id`/`org_id` vía patch. 0 filas afectadas → `null` → el handler
  responde **404 (no 403)**, para no revelar la existencia de recursos ajenos.
- `remove(table, id)` → idem, devuelve `false` si no pertenece al tenant.

El middleware `tenantContext` deja `req.tenant.scoped` listo en cada request
autenticado. Defensa en profundidad para filesystem: `assertWithinUserEnv()`
valida `path.resolve(target).startsWith(userPaths.root + sep)` antes de tocar
cualquier archivo del usuario.

## Aislamiento de filesystem

`provisionUserEnv({ userId, orgId, tier })` crea (idempotente):

```
${DATA_DIR}/users/user_NNNNNN_env/   (0750)
├── .meta.json        # {userId, orgId, tier, seq, createdAt}
├── skills/  mcp/  connections/  workdir/  runs/  uploads/
└── vault/
    ├── Preferencias.md            (plantilla en español)
    ├── Aprendizajes_Repetitivos.md
    ├── Diarios/.gitkeep
    └── Conceptos/.gitkeep
```

### Secuencial `user_NNNNNN` (decisión de diseño)

El número es un **secuencial estable derivado de una secuencia Postgres
dedicada** (`user_env_seq`). Al provisionar por primera vez se reserva un valor
con `nextval()` (atómico, sin colisiones en concurrencia) y se persiste **dentro
de `.meta.json`** (campo `seq`). En provisiones posteriores se reusa el seq
existente buscando el `.meta.json` del usuario. Garantías:

- **Determinista** por usuario (una vez asignado no cambia).
- **Único** (secuencia atómica).
- Independiente del orden de los UUID.

No se escanea/parsea el nombre de los directorios para "adivinar" el siguiente
número (frágil ante borrados). Ver `TODO-DEUDA(userenv-seq-db)` abajo.

## Auth

JWT en cookie **httpOnly, sameSite=lax**, `secure` solo bajo HTTPS. Payload
mínimo `{ sub: userId, orgId, tier }`, expiración 7 días. El estado autoritativo
vive en DB; el JWT es solo credencial de sesión. Hash de password con
`bcryptjs` (12 rounds). Logout es stateless (limpia la cookie del cliente).

`POST /api/auth/register` es transaccional: crea `users` + `organizations`
personal + `org_members(owner)` + `user_settings` + `usage_quotas` del periodo
según tier, y luego provisiona el env de filesystem.

## Deudas técnicas anotadas

- **`TODO-DEUDA(tenant-linter)`** — falta el linter ESLint custom que prohíba
  `db.select().from()` directo fuera de `services/admin/*`. Hoy la regla se
  enforce por convención + tests no-leak. (Riesgo #2 del plan.)
- **`TODO-DEUDA(quota-check)`** — `quotaCheck()` en `middleware/tenant.ts` es un
  passthrough stub. Falta enforcement real (402 + incremento de `used_value`).
- **`TODO-DEUDA(userenv-seq-db)`** — espejear el `seq` del env en una columna
  `users.env_seq` para lookup O(1) sin escanear `.meta.json` en filesystem.
- **`TODO-DEUDA(register-provision-atomicity)`** — la provisión de filesystem
  ocurre fuera de la transacción de DB. Si falla, el registro igual procede (el
  env es reprovisionable de forma idempotente), pero conviene un job de
  reconciliación o reintento.
- **Tablas de dominio aún no portadas de V1**: solo se portaron `agents`,
  `projects`, `issues` como set representativo para probar tenancy. Faltan
  routines, publications, transactions (finanzas canónica), connections,
  skill_installations, vault_chunks, telegram_pairings, notifications,
  agent_repair_attempts, billing_events, gmail_oauth_tokens — son de hitos 1–5.
- **`subscriptions` / `usage_quotas`**: estructura base creada, sin integración
  MercadoPago ni cron de reset mensual (Hito 5).
- **Endpoints de dominio**: solo `agents` tiene CRUD completo. `projects`/`issues`
  tienen schema + seed pero aún no router (agents basta para los tests de fuga).
