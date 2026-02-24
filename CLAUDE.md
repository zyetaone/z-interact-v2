# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

workspace-studio-v2 is a SvelteKit 2 application — an AI-powered workspace design platform for interactive seminars. Participants at physical tables (1-10) collaboratively edit workspace images using AI inpainting, segmentation, and 3D generation. Deployed on Cloudflare Workers with D1 (database) and R2 (image storage).

## Development Commands

```sh
bun run dev              # Start Vite dev server (http://localhost:5173) with platformProxy
bun run build            # Production build for Cloudflare Workers
bun run preview          # Preview production build locally
bun run check            # Svelte type checking
bun run test             # Run unit tests (vitest)
bun run test:watch       # Run tests in watch mode
bun run lint             # Prettier + ESLint checks
bun run format           # Auto-format with Prettier
bun run dev:wrangler     # Build + run with Wrangler (D1/R2 access)
bun run deploy           # Build + deploy to Cloudflare Workers
```

### Database (Drizzle + D1/libSQL)

```sh
bun run db:push          # Push schema directly to DB (dev workflow)
bun run db:generate      # Generate migrations from schema changes
bun run db:migrate       # Apply migrations
bun run db:studio        # Open Drizzle Studio GUI
```

Local dev uses `DATABASE_URL=file:local.db` (libSQL fallback). Production uses D1 via `platform.env.DB`.

## Tech Stack

- **SvelteKit 2** with **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`)
- **Vite 7** build tool, **TypeScript 5.9** (strict mode)
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin (forms + typography plugins)
- **Drizzle ORM** with D1 (production) + `@libsql/client` (local dev fallback)
- **Cloudflare Workers** via `@sveltejs/adapter-cloudflare` with D1 + R2 bindings
- **fal.ai** — AI image editing (Flux Inpainting, Nano Banana Pro), segmentation (SAM2)
- **Valibot** — Schema validation for remote function inputs
- **Three.js** — 3D scene rendering (isometric workspace viewer)
- **Bun** package manager

## Architecture

### Remote Functions (Critical Pattern)

The app uses SvelteKit's **experimental `command()` remote functions** (`svelte.config.js: experimental.remoteFunctions = true`). The core AI operations are defined in `src/routes/forge/ai.remote.ts` and called directly from Svelte components as typed async functions — no fetch/REST boilerplate.

Remote commands defined:

- `editImage` — AI image editing with mask/asset support, content filtering, edit limit enforcement
- `segmentObject` — SAM2 point-based segmentation
- `deleteImage` — Version tree leaf node deletion
- `completeSpace` — Mark a space as complete for the world view

All inputs validated with Valibot schemas. This is the primary server interaction pattern for the editor — prefer adding new commands here over creating new API routes.

### Database Layer (`src/lib/server/db/`)

- `schema.ts` — Four tables: `sessions`, `questChoices`, `spaces`, `editHistory`
- `index.ts` — `getDb(platform?)` factory: D1 via WeakMap cache (production) or libSQL singleton (local dev)
- `queries.ts` — All DB operations use `getRequestEvent()` internally via a private `db()` helper

Key pattern — `addEditNode()` uses atomic `UPDATE ... WHERE editCount < MAX` to prevent race conditions on concurrent edits.

### Version Tree

Edit history forms a tree (not a linear chain). Each edit node has a `parentId`, enabling branching. Users can navigate to any historical node and branch from it. The tree is built client-side by `src/lib/utils/version-tree.ts` (`buildTree()` → `TreeNode[]`) with semantic version labels (1.1, 1.2.1, etc.).

### AI Layer (`src/lib/server/ai/`)

Factory pattern with interface-based abstraction. `index.ts` exports `createImageEditor()` and `createImageSegmenter()`.

**Image editing routing** (`fal-editor.ts`) selects model based on inputs:

- Asset + mask → Flux Inpainting (asset described in prompt)
- Asset only → Nano Banana Pro (multi-image edit)
- Mask only → Flux Inpainting (region editing)
- Neither → Nano Banana Pro (whole-image prompt edit)

`configureFal()` reads credentials from `platform.env` (production) or `process.env` (local), with optional Cloudflare AI Gateway proxy.

### Editor State (`src/lib/editor.svelte.ts`)

Svelte 5 class-based reactive state using `$state` and `$derived` runes. Manages prompt, mask tool state (draw/brush/magic/poly), mask shapes (rects, paths, polygons), and AI-generated masks. Instantiated per-editor page.

### Storage (`src/lib/server/storage.ts`)

`persistImage()` downloads from trusted fal.ai domains and uploads to R2. Includes SSRF protection (HTTPS-only, domain allowlist, redirect blocking, size limits). Local dev proxies R2 via `/api/r2/[...key]`.

### Routing

| Route              | Purpose                                                    |
| ------------------ | ---------------------------------------------------------- |
| `/`                | Landing page / returning user dashboard                    |
| `/quest`           | Interactive 5-step binary-choice quiz                      |
| `/forge/[spaceId]` | AI workspace editor (mask + prompt → inpainting)           |
| `/world`           | 3D isometric scene (Three.js, image panels on hex islands) |
| `/metaverse`       | Shared gallery of all completed worlds                     |

### API Routes

| Endpoint           | Method | Purpose                                        |
| ------------------ | ------ | ---------------------------------------------- |
| `/api/upload`      | POST   | Upload image to R2 (10MB max, JPEG/PNG/WebP)   |
| `/api/r2/[...key]` | GET    | Local dev R2 proxy (UUID-format keys only)     |
| `/api/reorder`     | POST   | Save island arrangement order                  |
| `/api/session`     | DELETE | Clear session cookie (server-side)             |
| `/api/seed`        | POST   | Create seed content for demos                  |
| `/api/cleanup`     | POST   | Remove stale sessions (bearer-token protected) |

### Config

- `src/lib/config/tables.ts` — `TABLE_COUNT = 10`, `EDITOR_TABLE_ID = 0`, `MAX_EDITS_PER_TABLE = 20`
- `src/lib/config/assets.ts` — Furniture/workspace reference images (`ASSET_IMAGES`)
- `src/lib/utils/edit-prompt.ts` — Content filter blocked terms list

## Code Style

- **Tabs** for indentation, **single quotes**, **no trailing commas**, **100 char** print width
- Prettier with svelte + tailwindcss plugins (Tailwind classes sorted via `tailwindStylesheet` config)
- ESLint 9 flat config with TypeScript + Svelte; `no-undef` disabled (TypeScript handles it)
- Icons from `@lucide/svelte`

## Cloudflare Bindings

Defined in `wrangler.jsonc` and typed in `src/app.d.ts` (`App.Platform.env`):

| Binding                    | Type      | Usage                  |
| -------------------------- | --------- | ---------------------- |
| `DB`                       | D1        | SQLite database        |
| `R2_IMAGES`                | R2 Bucket | Image storage          |
| `R2_PUBLIC_URL`            | Var       | Public R2 CDN base URL |
| `FAL_API_KEY`              | Secret    | fal.ai API key         |
| `CLOUDFLARE_ACCOUNT_ID`    | Secret    | AI Gateway (optional)  |
| `CLOUDFLARE_AI_GATEWAY_ID` | Secret    | AI Gateway (optional)  |

Platform access: `getRequestEvent()?.platform?.env?.DB` (from `$app/server`).

Secrets go in `.dev.vars` locally (copy `.dev.vars.example`), or `bunx wrangler secret put <KEY>` for production.

## Svelte MCP Server

A Svelte MCP server is configured (`.mcp.json`) providing documentation tools:

1. **list-sections** — Discover available Svelte/SvelteKit doc sections (call first)
2. **get-documentation** — Fetch full doc content for specific sections
3. **svelte-autofixer** — Analyze Svelte code for issues (use before sending code)
4. **playground-link** — Generate Svelte Playground links (only if code not written to files)
