# Company Technology Standards

> **Maintained by:** `cs-tech-stack-guardian` (architecture team)
> **How to update:** Ask `cs-tech-stack-guardian` to amend a section. All changes require a brief rationale and are logged at the bottom of this file.
> **Scope:** All projects built under this SDLC, regardless of team or project size.

---

## 1. Language Standards

| Layer | Language | Version floor |
|-------|----------|---------------|
| Frontend | TypeScript | 5.x+ (strict mode required) |
| Backend | TypeScript on Node.js | TypeScript 5.x+, Node.js 20 LTS+ |
| Scripts / tooling | TypeScript or bash | No Python in scripts unless ML/data pipeline |
| SQL | ANSI SQL (PostgreSQL dialect) | PostgreSQL 15+ |

### TypeScript settings (required in every project)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

---

## 2. Frontend Standards

### 2.1 Framework policy

**No frontend framework. Use the platform.**

Rationale: Framework churn is a long-term enterprise liability. Web Components are a W3C standard that every browser natively supports. Projects built on native APIs never become "legacy" due to a framework version upgrade.

| Approved | Banned |
|----------|--------|
| Native Web Components (`customElements`, `HTMLElement`, Shadow DOM) | React, Vue, Angular, Svelte, Solid, Qwik, any SPA framework |
| TypeScript transpiled to ES2022 modules | JSX / TSX files |
| Lit 3.x (thin Web Component helper, 6 kB) — allowed when team agrees | Next.js, Nuxt, Remix, SvelteKit, Astro, or any meta-framework |
| Vite (bundler only — transpile + bundle, no framework integration) | Create React App, Webpack for greenfield |
| CSS Custom Properties for theming | CSS-in-JS, Tailwind, styled-components |
| Vanilla CSS with BEM or Cube CSS naming | Any runtime CSS framework that injects at build time |

### 2.2 Web Component conventions

- One component per file, named `<feature>-<element>.ts` → e.g. `auth-login-form.ts`
- Custom element tags: kebab-case, prefixed with project namespace → e.g. `<acme-login-form>`
- Shadow DOM: required for leaf UI components; open shadow root only
- Attributes: all lowercase kebab; properties: camelCase; never expose mutable state via attributes

### 2.3 Styling

- Global styles in `src/styles/global.css`; component styles inside Shadow DOM only
- CSS custom properties (variables) for all design tokens — colors, spacing, typography
- No inline style strings in JavaScript
- Dark-mode via `prefers-color-scheme` media query at the `:root` token level

### 2.4 Frontend build

- Bundler: Vite (production build only; dev server is allowed)
- Output: ES2022 modules, no CommonJS for browser code
- Target browsers: last 2 major versions of Chrome, Firefox, Safari, Edge (Chromium)

---

## 3. Backend Standards

### 3.1 Runtime and framework

| Concern | Approved choice |
|---------|----------------|
| Runtime | Node.js 20 LTS (or 22 LTS when released) |
| Language | TypeScript (strict mode — same tsconfig as §1) |
| HTTP framework | Fastify 5.x |
| Schema / validation | Zod 3.x (shared with frontend via workspace packages) |
| Background jobs | BullMQ (Redis-backed) for async queues; cron via `node-cron` for scheduled tasks |

**Banned backend choices:** Express for new projects (legacy only), NestJS, Hapi, Koa, Python runtimes (unless ML/data pipeline story), Java/Go/Rust (requires architecture exception).

### 3.2 API design

- REST by default; follow OpenAPI 3.1 contract-first (write spec before routes)
- Return standard envelope: `{ data: T, error: null }` or `{ data: null, error: { code, message } }`
- HTTP status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity, 500 Internal Server Error
- Versioning: URL-path prefix `/v1/`, `/v2/` — never headers
- No GraphQL unless the PRD explicitly calls for a public graph API

### 3.3 Authentication

- Supabase Auth (JWT issued by Supabase, verified server-side via `@supabase/supabase-js`)
- Never roll a custom JWT signing/verification
- Sessions: stateless JWTs only; no server-side sessions

### 3.4 Error handling convention

```typescript
// All errors thrown as AppError instances
class AppError extends Error {
  constructor(
    public readonly code: string,   // machine-readable, SCREAMING_SNAKE
    public readonly status: number,  // HTTP status
    message: string,
    public readonly cause?: Error
  ) { super(message); }
}

// Never swallow errors silently — always log + rethrow or return
```

---

## 4. Database Standards

| Concern | Approved choice |
|---------|----------------|
| Primary database | PostgreSQL (managed via Supabase) |
| Access layer | Supabase client SDK (`@supabase/supabase-js`) for simple CRUD; raw SQL via `postgres` driver for complex queries |
| ORM | None (raw SQL preferred for transparency; no Prisma, Drizzle, TypeORM) |
| Migrations | Raw SQL migration files — numbered `NNNN_description.sql` — applied via Supabase CLI |
| Caching | Supabase Edge Cache for read-heavy data; Redis (Upstash) for session/queue |
| Search | PostgreSQL full-text search (`tsvector`/`tsquery`) first; Supabase Vector for semantic/AI search |

### 4.1 Schema conventions

- All table names: `snake_case`, plural → `user_accounts`, `billing_subscriptions`
- Primary keys: UUID v4 (`gen_random_uuid()`) — no serial integers
- Timestamps: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ` (trigger-maintained)
- Soft deletes: `deleted_at TIMESTAMPTZ NULL` (do not physically delete rows by default)
- Row Level Security: **enabled on every table** — no exceptions; all access through RLS policies

---

## 5. Project Folder Structure (Feature-Based)

All projects use a feature-based folder structure. Engineers must not invent alternative structures without a guardian exception.

### 5.1 Frontend project layout

```
project-root/
  src/
    features/          # One folder per domain feature
      auth/
        auth-login-form.ts     # Web Component
        auth-service.ts        # Business logic (no DOM)
        auth-types.ts          # Types / interfaces
        auth.test.ts           # Tests co-located
      dashboard/
        ...
    shared/
      components/      # Cross-feature reusable components
      services/        # Cross-feature utilities/services
      types/           # Global shared types
    core/
      router.ts        # Client-side router
      api-client.ts    # Fetch wrapper with auth headers
      config.ts        # Env var loading
    styles/
      global.css
      tokens.css       # CSS custom properties
    main.ts            # App entry point
  index.html
  vite.config.ts
  tsconfig.json
```

### 5.2 Backend project layout

```
project-root/
  src/
    features/          # One folder per domain feature
      auth/
        auth.routes.ts       # Fastify route handlers
        auth.service.ts      # Business logic
        auth.repository.ts   # Database queries
        auth.schema.ts       # Zod schemas
        auth.types.ts        # TypeScript types
        auth.test.ts         # Unit + integration tests co-located
      users/
        ...
    shared/
      middleware/       # Auth, rate-limit, error handler plugins
      errors/           # AppError class + error codes
      types/            # Global shared types
    core/
      database.ts       # Supabase client singleton
      config.ts         # Env var loading + validation
      app.ts            # Fastify app factory
  migrations/           # Numbered SQL migration files
  main.ts               # Server entry point
  tsconfig.json
  package.json
```

### 5.3 Monorepo / full-stack layout (when frontend + backend share a repo)

```
project-root/
  apps/
    web/               # Frontend (§5.1)
    api/               # Backend (§5.2)
  packages/
    shared-types/      # Shared TypeScript types
    shared-schemas/    # Shared Zod schemas (frontend + backend)
  package.json         # Workspace root (pnpm workspaces)
  turbo.json           # Turborepo (if needed)
```

---

## 6. Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Files (TypeScript) | kebab-case | `auth-service.ts` |
| Files (tests) | kebab-case + `.test.ts` | `auth-service.test.ts` |
| Classes | PascalCase | `AuthService` |
| Interfaces | PascalCase, no `I` prefix | `UserProfile` |
| Type aliases | PascalCase | `AuthResult` |
| Functions / methods | camelCase, verb-first | `getUserById`, `validateToken` |
| Variables / constants | camelCase | `currentUser` |
| Module-level constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Database tables | snake_case, plural | `user_accounts` |
| Database columns | snake_case | `created_at` |
| API routes | kebab-case, plural nouns | `/v1/user-accounts` |
| CSS classes | BEM (block__element--modifier) | `.auth-form__submit--disabled` |
| CSS custom properties | `--prefix-name` | `--color-primary-500` |
| Environment variables | SCREAMING_SNAKE | `SUPABASE_URL` |

---

## 7. Testing Standards

| Layer | Tool | Coverage floor |
|-------|------|----------------|
| Unit tests | Vitest | 80% for service/repository code |
| Component tests | Vitest + happy-dom | Critical component states |
| API integration | Vitest + Fastify `inject()` | All route handlers |
| E2E | Playwright | Golden paths + critical user flows |
| Contract tests | Zod schema validation at boundaries | All API endpoints |

- Tests are co-located with source code (same feature folder)
- No mocking of the database in integration tests — use a test Supabase project or local Supabase CLI
- Test file name: `<module>.test.ts`

---

## 8. Code Quality and Tooling

| Concern | Tool | Config |
|---------|------|--------|
| Lint + format | Biome | `biome.json` at project root |
| Type checking | `tsc --noEmit` | Per-project `tsconfig.json` with strict settings from §1 |
| Secret scanning | `gitleaks` | In CI pre-push |
| SAST | Semgrep | In CI on PRs |
| Dependency audit | `pnpm audit` | Blocking on critical CVEs |

### 8.1 Biome config baseline

```json
{
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "trailingCommas": "all" } }
}
```

---

## 9. Infrastructure and Deployment

| Concern | Standard |
|---------|---------|
| Hosting (web apps) | Vercel (frontend) |
| Hosting (APIs) | Vercel Serverless Functions or Railway (for long-running servers) |
| Database | Supabase (managed) |
| Queue / cache | Upstash Redis |
| CI/CD | GitHub Actions |
| Container | Docker for local dev only; not required for Vercel/Railway deploys |
| Secrets management | Environment variables; never commit `.env.local` |

---

## 10. Banned Technologies (for new projects)

| Technology | Reason |
|-----------|--------|
| React, Vue, Angular, Svelte, Solid | Framework lock-in; replaced by Web Components |
| Next.js, Nuxt, Remix, SvelteKit, Astro | Meta-framework lock-in |
| Express.js (new projects) | Superseded by Fastify; legacy projects may keep it |
| NestJS | Over-engineered DI system adds unnecessary complexity |
| Prisma, TypeORM, Drizzle | ORM complexity; raw SQL is preferred |
| GraphQL (without exception) | REST + Zod is sufficient; GraphQL requires architecture sign-off |
| MongoDB, Firebase, DynamoDB | PostgreSQL covers all use cases for this stack |
| Python (non-ML projects) | Unified TypeScript stack; Python only allowed for AI/ML workloads |
| jQuery | Never |
| Webpack (greenfield) | Vite is the approved bundler |

---

## 11. Exception Process

When a project genuinely cannot use an approved technology (e.g., a client mandates a specific stack, an ML workload requires Python, an acquired codebase uses a banned tool), follow this process:

1. The engineering lead invokes `cs-tech-stack-guardian` with `exception_request: true` and the reason.
2. The guardian documents the exception in this file under §12.
3. The exception must include: affected project, technology, reason, risks, and the user/tech lead who approved it.
4. Exceptions are scoped to the named project only — they do not set a new default.

---

## 12. Exceptions Log

| Date | Project | Exception | Reason | Approved by |
|------|---------|-----------|--------|------------|
| — | — | — | — | — |

---

## 13. Change Log

| Date | Section changed | Summary | Requested by |
|------|----------------|---------|-------------|
| 2026-06-29 | All | Initial standards created | Architecture team |
