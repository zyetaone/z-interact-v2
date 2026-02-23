# Monorepo Extraction + Game Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract editor/AI/3D into shared packages and standalone editor app, then enhance the game with personality archetypes, cinematic modals, seed content, and polish.

**Architecture:** Bun workspace monorepo with 2 apps (game, editor) and 3 shared packages (ai, editor-ui, scene). Shared packages use **source exports** (no build step, no svelte-package — consuming SvelteKit apps compile `.svelte` files directly via Vite). AI layer refactored from SvelteKit-coupled to **dependency-injected** (`$app/server` stays inside each app's `src/`, shared packages accept config as parameters).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Bun workspaces (no Turborepo), Tailwind CSS 4, fal.ai, Threlte 8, Drizzle ORM, Cloudflare Workers/D1/R2, Valibot.

**Research findings applied:**
- `$app/server` is a SvelteKit virtual module — only resolves inside an app's `src/`. Shared packages MUST NOT import it.
- Svelte packages use source exports (`"exports": { ".": "./src/index.ts" }`) — Vite in the consuming app compiles them.
- `ssr.noExternal` may be needed in consuming apps' `vite.config.ts` for workspace Svelte packages.
- Use `bun --cwd apps/game dev` for per-app commands. `bun add <dep> --cwd apps/game` for per-workspace installs.
- No `--filter` for `bun add` (broken). Use `--cwd` exclusively.
- Internal package imports must use **relative paths** (no `$lib` aliases — those resolve relative to the consuming SvelteKit app, not the package).

---

## Phase 0: Monorepo Extraction (Tasks 1-6)

### Task 1: Scaffold Monorepo Root

**Goal:** Move current project into `apps/game/`, create package stubs, set up bun workspaces.

**Files:**
- Create: `apps/game/` (move ALL current project files here)
- Create: `packages/ai/package.json`, `packages/ai/src/index.ts`
- Create: `packages/editor-ui/package.json`, `packages/editor-ui/src/index.ts`
- Create: `packages/scene/package.json`, `packages/scene/src/index.ts`
- Create: root `package.json` (workspace config)
- Create: root `tsconfig.base.json`

**Steps:**

1. Create directory structure:
```bash
mkdir -p apps/game packages/ai/src packages/editor-ui/src packages/scene/src
```

2. Move current project files into `apps/game/`:
```bash
for item in src static wrangler.jsonc svelte.config.js vite.config.ts tsconfig.json \
  drizzle.config.ts .prettierrc .prettierignore eslint.config.js .dev.vars.example \
  .wrangler local.db; do
  [ -e "$item" ] && mv "$item" apps/game/
done
```

3. Create root `package.json`:
```json
{
  "name": "workspace-studio",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:game": "bun --cwd apps/game dev",
    "dev:editor": "bun --cwd apps/editor dev",
    "build:game": "bun --cwd apps/game build",
    "build:editor": "bun --cwd apps/editor build",
    "check": "bun --cwd apps/game check",
    "lint": "bun --cwd apps/game lint",
    "format": "bun --cwd apps/game format"
  }
}
```

4. Create `apps/game/package.json` (adapt from current `package.json`):
   - Rename to `"name": "@workspace-studio/game"`
   - Add workspace deps: `"@workspace-studio/ai": "workspace:*"`, etc.
   - Keep all existing deps and devDeps

5. Create package stubs with source exports:

`packages/ai/package.json`:
```json
{
  "name": "@workspace-studio/ai",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@fal-ai/client": "^1.9.3" }
}
```

`packages/editor-ui/package.json`:
```json
{
  "name": "@workspace-studio/editor-ui",
  "private": true,
  "type": "module",
  "svelte": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "peerDependencies": { "svelte": "^5.0.0", "@lucide/svelte": "^0.500.0" }
}
```

`packages/scene/package.json`:
```json
{
  "name": "@workspace-studio/scene",
  "private": true,
  "type": "module",
  "svelte": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "peerDependencies": {
    "svelte": "^5.0.0",
    "@threlte/core": "^8.0.0",
    "@threlte/extras": "^9.0.0",
    "three": "^0.183.0"
  }
}
```

6. Create `tsconfig.base.json` at root:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

Each package gets `tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "include": ["src"] }`.

7. Run `bun install` from root. Then `bun --cwd apps/game check`.

8. Commit: `git add -A && git commit -m "chore: scaffold monorepo with bun workspaces"`

---

### Task 2: Extract `packages/ai/` — AI Client Layer

**Goal:** Refactor all AI functions from SvelteKit-coupled to dependency-injected. Move to shared package.

**Files to create in `packages/ai/src/`:**
- `types.ts` — AI types + `AiConfig`, `StorageBackend`, `StorageConfig` interfaces
- `config.ts` — `initFal(config: AiConfig)` (pure, no `$app/server`)
- `editor.ts` — `createImageEditor(config: AiConfig): ImageEditor`
- `segmenter.ts` — `createImageSegmenter(config: AiConfig): ImageSegmenter`
- `glb.ts` — `generateGlb(req, config: AiConfig)`
- `video.ts` — `generateVideoClip(req, idx, config: AiConfig)`
- `storage.ts` — `persistImage(url, storage: StorageConfig)`, `persistGlb(url, storage: StorageConfig)`
- `resolve.ts` — `resolveImageForFal(url, r2: StorageBackend, config: AiConfig)`
- `index.ts` — re-export everything

**Key refactoring pattern:**

```typescript
// BEFORE (SvelteKit-coupled, in apps/game/src/lib/server/ai/fal-config.ts)
import { getRequestEvent } from '$app/server';
export function configureFal() {
  const env = getRequestEvent()?.platform?.env;
  fal.config({ credentials: env?.FAL_API_KEY ?? process.env.FAL_API_KEY! });
}

// AFTER (pure, in packages/ai/src/config.ts)
export interface AiConfig { apiKey: string; accountId?: string; gatewayId?: string; }
export function initFal(config: AiConfig) {
  const proxy = config.accountId && config.gatewayId
    ? { proxyUrl: `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/fal-ai` }
    : {};
  fal.config({ credentials: config.apiKey, ...proxy });
}
```

Then in `apps/game/`, create a single thin adapter at `src/lib/server/ai.ts`:

```typescript
import { getRequestEvent } from '$app/server';
import { createImageEditor, createImageSegmenter, ... } from '@workspace-studio/ai';
import type { AiConfig, StorageConfig } from '@workspace-studio/ai';

function getAiConfig(): AiConfig {
  const env = getRequestEvent()?.platform?.env;
  return {
    apiKey: env?.FAL_API_KEY ?? process.env.FAL_API_KEY!,
    accountId: env?.CLOUDFLARE_ACCOUNT_ID,
    gatewayId: env?.CLOUDFLARE_AI_GATEWAY_ID
  };
}
// ... thin wrappers that inject config into each function
```

After adapter works, **delete** `apps/game/src/lib/server/ai/` (the entire old directory).
Update all imports across `apps/game/` to use `$lib/server/ai` (the new single adapter file).

Verify: `bun --cwd apps/game check && bun --cwd apps/game lint`

Commit: `git commit -m "refactor: extract AI client to @workspace-studio/ai package"`

---

### Task 3: Extract `packages/editor-ui/` — Svelte Editor Components

**Goal:** Move editor state class, all editor components, canvas actions, and utils to shared package.

**Files to move:**
- `editor.svelte.ts` → `packages/editor-ui/src/Editor.svelte.ts`
- `actions/mask-canvas.svelte.ts` → `packages/editor-ui/src/mask-canvas.svelte.ts`
- `components/CommandBar.svelte` → `packages/editor-ui/src/CommandBar.svelte`
- `components/EditorBar.svelte` → `packages/editor-ui/src/EditorBar.svelte`
- `components/VersionTree.svelte` → `packages/editor-ui/src/VersionTree.svelte`
- `components/BottomSheet.svelte` → `packages/editor-ui/src/BottomSheet.svelte`
- `components/LayerBar.svelte` → `packages/editor-ui/src/LayerBar.svelte`
- `utils/mask.ts` → `packages/editor-ui/src/mask.ts`
- `utils/version-tree.ts` → `packages/editor-ui/src/version-tree.ts`
- `utils/edit-prompt.ts` → `packages/editor-ui/src/edit-prompt.ts`
- `types/workspace.ts` → `packages/editor-ui/src/types.ts`

**Critical:** Fix all internal imports within the package to use **relative paths** (not `$lib/...`). For example, if `CommandBar.svelte` imports from `$lib/editor.svelte`, change to `import { Editor } from './Editor.svelte'`.

Create `packages/editor-ui/src/index.ts` re-exporting everything.

Update `apps/game/` imports: replace `$lib/editor.svelte`, `$lib/components/CommandBar.svelte`, `$lib/utils/mask`, etc. with `@workspace-studio/editor-ui`.

If SSR errors appear, add to `apps/game/vite.config.ts`:
```typescript
ssr: { noExternal: ['@workspace-studio/editor-ui'] }
```

Verify: `bun --cwd apps/game check`

Commit: `git commit -m "refactor: extract editor UI to @workspace-studio/editor-ui package"`

---

### Task 4: Extract `packages/scene/` — Threlte 3D Components

**Goal:** Move Three.js/Threlte scene components to shared package.

**Files to move:**
- `components/IsometricScene.svelte` → `packages/scene/src/IsometricScene.svelte`
- `components/scene/Scene.svelte` → `packages/scene/src/Scene.svelte`
- `components/scene/RoomModel.svelte` → `packages/scene/src/RoomModel.svelte`
- `components/scene/Avatar.svelte` → `packages/scene/src/Avatar.svelte`

Fix internal imports to relative. Create index.ts.
Update `apps/game/` imports to `@workspace-studio/scene`.

Verify: `bun --cwd apps/game check`

Commit: `git commit -m "refactor: extract 3D scene to @workspace-studio/scene package"`

---

### Task 5: Create `apps/editor/` — Standalone AI Image Editor

**Goal:** New SvelteKit app for general-purpose AI image editing. Uses shared packages.

**Routes:**
- `/` — Upload or paste an image to start editing
- `/edit/[imageId]` — Full editor (reuses `@workspace-studio/editor-ui` components)
- `/edit/ai.remote.ts` — editImage, segmentObject, deleteImage commands
- `/api/upload/+server.ts` — Image upload to R2
- `/api/r2/[...key]/+server.ts` — Local dev R2 proxy

**DB Schema** (simpler than game — no sessions, no quests):
```typescript
// apps/editor/src/lib/server/db/schema.ts
images: { id, originalUrl, currentUrl, editCount, activeNodeId, createdAt }
editHistory: { id, imageId, parentId, imageUrl, prompt, step, createdAt }
```

**Config files**: Copy from `apps/game/` and adapt:
- `svelte.config.js` — same adapter-cloudflare config
- `vite.config.ts` — same plugins, add `ssr.noExternal` for workspace packages
- `wrangler.jsonc` — separate D1 database (`workspace-editor-db`), same R2 bucket
- `app.html`, `app.css` — copy and simplify

**AI adapter**: Same thin wrapper pattern as game app.

**Workspace state**: Create `apps/editor/src/lib/workspace.svelte.ts` — simplified ForgeWorkspace (no sessions, no spaces, just images + editHistory).

Verify: `bun --cwd apps/editor check && bun --cwd apps/editor lint`

Commit: `git commit -m "feat: standalone AI image editor app using shared packages"`

---

### Task 6: Verify Full Monorepo

**Goal:** Both apps build clean, dev servers work.

1. `bun install` (root)
2. `bun --cwd apps/game check && bun --cwd apps/game lint`
3. `bun --cwd apps/editor check && bun --cwd apps/editor lint`
4. `bun run dev:game` — verify quest/forge/world routes work
5. `bun run dev:editor` — verify upload/edit routes work
6. Fix any issues, commit: `git commit -m "chore: monorepo verified — both apps build clean"`

---

## Phase 1: Game Enhancement (Tasks 7-16)

### Task 7: Reduce Quest to 5 Steps

**Files:**
- Modify: `apps/game/src/lib/config/quest.ts` — Remove step 5 (Collaboration) and step 7 (Kitchen), renumber 1-5
- Modify: `apps/game/src/routes/quest/+page.svelte` — Update any "7" references to "5"

Verify: `bun --cwd apps/game check`
Commit: `git commit -m "feat: reduce quest to 5 steps — tighter pacing"`

---

### Task 8: Personality Engine — Archetypes Config

**Files:**
- Create: `apps/game/src/lib/config/archetypes.ts`

Contains: `DimensionScores` interface, `DIMENSION_WEIGHTS` per step, 8 `Archetype` definitions with match functions, `computeArchetype(choices)` algorithm.

Commit: `git commit -m "feat: archetype definitions and personality matching algorithm"`

---

### Task 9: Personality Engine — DB + Server Integration

**Files:**
- Modify: `apps/game/src/lib/server/db/schema.ts` — Add `archetype TEXT` and `isSeed INTEGER DEFAULT 0` to sessions
- Modify: `apps/game/src/lib/server/db/queries.ts` — Update session helpers
- Modify: `apps/game/src/routes/quest/ai.remote.ts` — Compute archetype in `saveQuest`, return it

Apply schema change to local D1:
```bash
bunx wrangler d1 execute workspace-studio-v2-db --local --command \
  "ALTER TABLE sessions ADD COLUMN archetype TEXT; ALTER TABLE sessions ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0;"
```

Verify: `bun --cwd apps/game check`
Commit: `git commit -m "feat: archetype storage — computed in saveQuest, persisted to sessions"`

---

### Task 10: CinematicModal Component

**Files:**
- Create: `apps/game/src/lib/components/CinematicModal.svelte`

Full-screen overlay: black/90 backdrop-blur-xl, scale transition, no X button, Enter triggers CTA slot, body scroll lock via `$effect`. Props: `open`, `onclose`. Uses Svelte `transition:fade` + `transition:scale`.

Commit: `git commit -m "feat: CinematicModal — full-screen mandatory overlay component"`

---

### Task 11: Modal 1 — Personality Reveal (Quest)

**Files:**
- Modify: `apps/game/src/routes/quest/+page.svelte` — Add reveal modal after quest completion
- Modify: `apps/game/src/routes/quest/ai.remote.ts` — Return archetype data in `saveQuest` response

Staggered animations: icon scale-in → "You are..." fade → name typewriter → description fade → 5 thumbnails stagger → "Enter the Forge" pulse CTA.

Verify: `bun --cwd apps/game check`
Commit: `git commit -m "feat: personality reveal modal after quest completion"`

---

### Task 12: Modal 2 — Space Forged (Forge)

**Files:**
- Modify: `apps/game/src/routes/forge/[spaceId]/+page.svelte` — Show modal after completeSpace
- Modify: `apps/game/src/routes/forge/[spaceId]/+page.server.ts` — Load all session spaces for progress
- Modify: `apps/game/src/routes/forge/forge-workspace.svelte.ts` — Expose nextSpaceId after completion

Checkmark SVG draw-in → "Space Forged" → progress dots ("2 of 5") → "Forge Next" or "Enter Your World" CTA.

Verify: `bun --cwd apps/game check`
Commit: `git commit -m "feat: space-forged modal with progress tracking"`

---

### Task 13: Modal 3 — World Unlocked (World)

**Files:**
- Modify: `apps/game/src/routes/world/+page.svelte` — One-time reveal modal
- Modify: `apps/game/src/routes/world/+page.server.ts` — Return `allComplete` flag

Trigger: first `/world` load when all spaces complete + no `world-revealed` in localStorage. Island count scales in → "Your World Is Complete" → fades away. Sets localStorage flag.

Verify: `bun --cwd apps/game check`
Commit: `git commit -m "feat: world-unlocked modal — one-time reveal ceremony"`

---

### Task 14: Seed Content

**Files:**
- Create: `apps/game/src/routes/api/seed/+server.ts`
- Modify: `apps/game/src/lib/server/db/queries.ts` — Add seed helpers

POST `/api/seed` (requires `X-Seed-Key` header matching env `SEED_SECRET`). Creates 5 seed sessions (`isSeed: true`, random archetype) with 1 completed space each using unused static asset images.

Verify: `bun --cwd apps/game check`
Commit: `git commit -m "feat: seed content endpoint for metaverse population"`

---

### Task 15: Game Feel Polish

**Files:**
- Modify: `apps/game/src/routes/quest/+page.svelte` — Shimmer progress bar, blur-in images
- Modify: `apps/game/src/routes/forge/[spaceId]/+page.svelte` — Completion button morph
- Modify: `apps/game/src/routes/world/+page.svelte` — Entry camera animation
- Modify: `apps/game/src/routes/+page.svelte` — Show archetype on dashboard
- Modify: `apps/game/src/routes/+page.server.ts` — Include archetype in load data

Commit: `git commit -m "feat: game-feel polish — shimmer, blur, camera, dashboard archetype"`

---

### Task 16: Final Verification

1. `bun --cwd apps/game check && bun --cwd apps/game lint`
2. `bun --cwd apps/editor check && bun --cwd apps/editor lint`
3. Smoke test both apps
4. Commit any fixes: `git commit -m "chore: final verification — all checks pass"`

---

## Task Dependency Graph

```
Phase 0 (Sequential — each builds on previous):
  Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

Phase 1 (Partially Parallel after Task 6):
  Task 7 (quest reduction)     ─────────────┐
  Task 8 (archetypes config) → Task 9 (DB)  │
  Task 10 (CinematicModal) ─→ Task 11, 12, 13 (modals, parallel)
  Task 14 (seed content)       ─────────────┤
  Task 15 (polish)             ─────────────┘
                                             ↓
                                         Task 16 (verify)
```

## Team Composition for Agentic Execution

### Phase 0: Sequential (single agent or team lead)
Tasks 1-6 must be sequential — each restructures what the previous built. Best done by a single agent or team lead with full context.

### Phase 1: Parallel Team (4 agents)

| Agent | Tasks | Files touched |
|-------|-------|--------------|
| **quest-personality** | 7, 8, 9, 11 | config/quest.ts, config/archetypes.ts, quest/*.ts, db/schema+queries |
| **forge-modal** | 12 | forge/[spaceId]/*.ts, forge-workspace.svelte.ts |
| **world-modal** | 13, 14 | world/*.ts, api/seed/*.ts, db/queries.ts (seed helpers only) |
| **polish-dashboard** | 10, 15 | components/CinematicModal.svelte, +page.svelte, quest/page.svelte (shimmer only) |

No file overlap between agents in Phase 1.
