# Bun Monorepo Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure workspace-studio-v2 from a single SvelteKit app into a Bun workspace monorepo with 4 packages (`@zyeta/shared`, `@zyeta/editor-engine`, `@zyeta/world-engine`, `@zyeta/video-engine`) and 2 deployable apps (`apps/quest`, `apps/showcase`).

**Architecture:** Create `packages/` and `apps/` directories with Bun workspace config. Move existing `src/lib/` code into appropriate packages. Move routes into `apps/quest/`. Create a new `apps/showcase/` as a thin demo app. Update all import paths from `$lib/` to `@zyeta/` package imports. Each package has its own `package.json` with `"exports"` field.

**Tech Stack:** Bun workspaces, SvelteKit 2, Svelte 5, Vite 7, TypeScript 5.9, Cloudflare Workers

---

## File Movement Map (Reference)

This is the complete mapping of where every file moves. Tasks below reference this.

```
CURRENT PATH                                    → NEW PATH
═══════════════════════════════════════════════════════════════════════
# @zyeta/shared (packages/shared/)
src/lib/server/db/schema.ts                     → packages/shared/src/db/schema.ts
src/lib/server/db/index.ts                      → packages/shared/src/db/index.ts
src/lib/server/db/queries.ts                    → packages/shared/src/db/queries.ts
src/lib/types/workspace.ts                      → packages/shared/src/types/workspace.ts
src/lib/config/quest.ts                         → packages/shared/src/config/quest.ts
src/lib/config/archetypes.ts                    → packages/shared/src/config/archetypes.ts
src/lib/config/assets.ts                        → packages/shared/src/config/assets.ts
src/lib/utils/edit-prompt.ts                    → packages/shared/src/utils/edit-prompt.ts
src/lib/utils/edit-prompt.test.ts               → packages/shared/src/utils/edit-prompt.test.ts
src/lib/utils/download.ts                       → packages/shared/src/utils/download.ts
src/lib/utils/version-tree.ts                   → packages/shared/src/utils/version-tree.ts
src/lib/utils/version-tree.test.ts              → packages/shared/src/utils/version-tree.test.ts
src/lib/components/Toast.svelte                 → packages/shared/src/components/Toast.svelte
src/lib/components/CinematicModal.svelte        → packages/shared/src/components/CinematicModal.svelte
src/lib/components/BottomSheet.svelte           → packages/shared/src/components/BottomSheet.svelte

# @zyeta/editor-engine (packages/editor-engine/)
src/lib/editor.svelte.ts                        → packages/editor-engine/src/editor.svelte.ts
src/lib/server/ai/index.ts                      → packages/editor-engine/src/server/ai/index.ts
src/lib/server/ai/types.ts                      → packages/editor-engine/src/server/ai/types.ts
src/lib/server/ai/fal-editor.ts                 → packages/editor-engine/src/server/ai/fal-editor.ts
src/lib/server/ai/fal-segmenter.ts              → packages/editor-engine/src/server/ai/fal-segmenter.ts
src/lib/server/ai/fal-config.ts                 → packages/editor-engine/src/server/ai/fal-config.ts
src/lib/server/storage.ts                       → packages/editor-engine/src/server/storage.ts
src/lib/components/EditorBar.svelte             → packages/editor-engine/src/components/EditorBar.svelte
src/lib/components/VersionTree.svelte           → packages/editor-engine/src/components/VersionTree.svelte
src/lib/components/CommandBar.svelte            → packages/editor-engine/src/components/CommandBar.svelte
src/lib/actions/mask-canvas.svelte.ts           → packages/editor-engine/src/actions/mask-canvas.svelte.ts
src/lib/utils/mask.ts                           → packages/editor-engine/src/utils/mask.ts

# @zyeta/world-engine (packages/world-engine/)
src/lib/components/IsometricScene.svelte        → packages/world-engine/src/IsometricScene.svelte
src/lib/components/scene/Scene.svelte           → packages/world-engine/src/scene/Scene.svelte
src/lib/components/scene/RoomModel.svelte       → packages/world-engine/src/scene/RoomModel.svelte
src/lib/components/scene/Avatar.svelte          → packages/world-engine/src/scene/Avatar.svelte

# @zyeta/video-engine (packages/video-engine/)
(No existing files — this is created from scratch or from the standalone /video route if it exists)

# apps/quest (main Workspace DNA app)
src/routes/*                                    → apps/quest/src/routes/*
src/hooks.server.ts                             → apps/quest/src/hooks.server.ts
src/app.html                                    → apps/quest/src/app.html
src/app.d.ts                                    → apps/quest/src/app.d.ts
src/routes/layout.css                           → apps/quest/src/routes/layout.css
src/lib/quest-engine.svelte.ts                  → apps/quest/src/lib/quest-engine.svelte.ts
src/lib/toast.svelte.ts                         → apps/quest/src/lib/toast.svelte.ts
src/routes/forge/forge-workspace.svelte.ts      → apps/quest/src/routes/forge/forge-workspace.svelte.ts
svelte.config.js                                → apps/quest/svelte.config.js
vite.config.ts                                  → apps/quest/vite.config.ts
wrangler.jsonc                                  → apps/quest/wrangler.jsonc
tsconfig.json                                   → apps/quest/tsconfig.json
drizzle.config.ts                               → apps/quest/drizzle.config.ts (if exists)
drizzle/                                        → apps/quest/drizzle/ (migrations)

# Root level (stays or is created)
package.json                                    → REWRITE (workspace root)
.prettierrc                                     → KEEP (shared)
eslint.config.js                                → KEEP (shared)
```

---

### Task 1: Create workspace root and directory scaffold

**Files:**
- Modify: `package.json` (rewrite as workspace root)
- Create: `packages/shared/package.json`
- Create: `packages/editor-engine/package.json`
- Create: `packages/world-engine/package.json`
- Create: `packages/video-engine/package.json`
- Create: `apps/quest/package.json`
- Create: `apps/showcase/package.json`

**Step 1: Create all directories**

```bash
mkdir -p packages/shared/src/{db,config,types,utils,components}
mkdir -p packages/editor-engine/src/{server/ai,components,actions,utils}
mkdir -p packages/world-engine/src/scene
mkdir -p packages/video-engine/src
mkdir -p apps/quest/src/{routes,lib}
mkdir -p apps/showcase/src/routes
```

**Step 2: Create root package.json**

Replace the current `package.json` with a Bun workspace root:

```json
{
  "name": "workspace-studio-v2",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "bun run --filter @zyeta/quest dev",
    "dev:showcase": "bun run --filter @zyeta/showcase dev",
    "build": "bun run --filter './apps/*' build",
    "check": "bun run --filter './apps/*' check",
    "test": "vitest run",
    "lint": "prettier --check . && eslint .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@eslint/compat": "^2.0.2",
    "@eslint/js": "^9.39.3",
    "eslint": "^9.39.3",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-svelte": "^3.15.0",
    "globals": "^17.3.0",
    "prettier": "^3.8.1",
    "prettier-plugin-svelte": "^3.5.0",
    "prettier-plugin-tailwindcss": "^0.7.2",
    "svelte": "^5.53.3",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.56.0",
    "vitest": "^4.0.18"
  }
}
```

**Step 3: Create `packages/shared/package.json`**

```json
{
  "name": "@zyeta/shared",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./db": "./src/db/index.ts",
    "./db/schema": "./src/db/schema.ts",
    "./db/queries": "./src/db/queries.ts",
    "./types": "./src/types/workspace.ts",
    "./config/quest": "./src/config/quest.ts",
    "./config/archetypes": "./src/config/archetypes.ts",
    "./config/assets": "./src/config/assets.ts",
    "./utils/*": "./src/utils/*.ts",
    "./components/*": "./src/components/*.svelte"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "@libsql/client": "^0.17.0",
    "valibot": "^1.2.0"
  },
  "peerDependencies": {
    "svelte": "^5.0.0"
  }
}
```

**Step 4: Create `packages/editor-engine/package.json`**

```json
{
  "name": "@zyeta/editor-engine",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./editor": "./src/editor.svelte.ts",
    "./server": "./src/server/index.ts",
    "./server/*": "./src/server/*.ts",
    "./components/*": "./src/components/*.svelte",
    "./actions/*": "./src/actions/*.svelte.ts",
    "./utils/*": "./src/utils/*.ts"
  },
  "dependencies": {
    "@zyeta/shared": "workspace:*",
    "@fal-ai/client": "^1.9.3"
  },
  "peerDependencies": {
    "svelte": "^5.0.0"
  }
}
```

**Step 5: Create `packages/world-engine/package.json`**

```json
{
  "name": "@zyeta/world-engine",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./scene/*": "./src/scene/*.svelte",
    "./IsometricScene": "./src/IsometricScene.svelte"
  },
  "dependencies": {
    "@zyeta/shared": "workspace:*",
    "@threlte/core": "^8.4.0",
    "@threlte/extras": "^9.8.1",
    "three": "^0.183.1"
  },
  "devDependencies": {
    "@types/three": "^0.183.1"
  },
  "peerDependencies": {
    "svelte": "^5.0.0"
  }
}
```

**Step 6: Create `packages/video-engine/package.json`**

```json
{
  "name": "@zyeta/video-engine",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@zyeta/shared": "workspace:*"
  },
  "peerDependencies": {
    "svelte": "^5.0.0"
  }
}
```

**Step 7: Create `apps/quest/package.json`**

```json
{
  "name": "@zyeta/quest",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "prepare": "svelte-kit sync || echo ''",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "dev:wrangler": "bun run build && bunx wrangler dev",
    "deploy": "bun run build && bunx wrangler deploy"
  },
  "dependencies": {
    "@zyeta/shared": "workspace:*",
    "@zyeta/editor-engine": "workspace:*",
    "@zyeta/world-engine": "workspace:*",
    "@lucide/svelte": "^0.563.1",
    "qrcode": "^1.5.4",
    "valibot": "^1.2.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-cloudflare": "^7.2.8",
    "@sveltejs/kit": "^2.53.0",
    "@sveltejs/vite-plugin-svelte": "^6.2.4",
    "@tailwindcss/forms": "^0.5.11",
    "@tailwindcss/typography": "^0.5.19",
    "@tailwindcss/vite": "^4.2.0",
    "@types/node": "^24.10.13",
    "@types/qrcode": "^1.5.6",
    "drizzle-kit": "^0.31.9",
    "svelte-check": "^4.4.3",
    "tailwindcss": "^4.2.0",
    "vite": "^7.3.1",
    "vite-plugin-devtools-json": "^1.0.0",
    "wrangler": "^4.67.0"
  }
}
```

**Step 8: Create `apps/showcase/package.json`**

```json
{
  "name": "@zyeta/showcase",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "prepare": "svelte-kit sync || echo ''",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "@zyeta/shared": "workspace:*",
    "@zyeta/editor-engine": "workspace:*",
    "@zyeta/world-engine": "workspace:*",
    "@zyeta/video-engine": "workspace:*",
    "@lucide/svelte": "^0.563.1"
  },
  "devDependencies": {
    "@sveltejs/adapter-cloudflare": "^7.2.8",
    "@sveltejs/kit": "^2.53.0",
    "@sveltejs/vite-plugin-svelte": "^6.2.4",
    "@tailwindcss/forms": "^0.5.11",
    "@tailwindcss/typography": "^0.5.19",
    "@tailwindcss/vite": "^4.2.0",
    "svelte-check": "^4.4.3",
    "tailwindcss": "^4.2.0",
    "vite": "^7.3.1",
    "vite-plugin-devtools-json": "^1.0.0",
    "wrangler": "^4.67.0"
  }
}
```

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo directory structure and package.json files"
```

---

### Task 2: Move shared package files

**Files:**
- Move files from `src/lib/` to `packages/shared/src/`
- Create: `packages/shared/src/index.ts` (barrel export)

**Step 1: Move DB layer**

```bash
cp src/lib/server/db/schema.ts packages/shared/src/db/schema.ts
cp src/lib/server/db/index.ts packages/shared/src/db/index.ts
cp src/lib/server/db/queries.ts packages/shared/src/db/queries.ts
```

**Step 2: Move types, config, utils, components**

```bash
cp src/lib/types/workspace.ts packages/shared/src/types/workspace.ts
cp src/lib/config/quest.ts packages/shared/src/config/quest.ts
cp src/lib/config/archetypes.ts packages/shared/src/config/archetypes.ts
cp src/lib/config/assets.ts packages/shared/src/config/assets.ts
cp src/lib/utils/edit-prompt.ts packages/shared/src/utils/edit-prompt.ts
cp src/lib/utils/edit-prompt.test.ts packages/shared/src/utils/edit-prompt.test.ts
cp src/lib/utils/download.ts packages/shared/src/utils/download.ts
cp src/lib/utils/version-tree.ts packages/shared/src/utils/version-tree.ts
cp src/lib/utils/version-tree.test.ts packages/shared/src/utils/version-tree.test.ts
cp src/lib/components/Toast.svelte packages/shared/src/components/Toast.svelte
cp src/lib/components/CinematicModal.svelte packages/shared/src/components/CinematicModal.svelte
cp src/lib/components/BottomSheet.svelte packages/shared/src/components/BottomSheet.svelte
```

**Step 3: Update internal imports in shared package**

Replace `$lib/` imports with relative paths within the package. Key files to update:

- `packages/shared/src/db/queries.ts` — change `$lib/server/db/schema` → `./schema`, `$app/server` → conditional import
- `packages/shared/src/db/index.ts` — change `$lib/server/db/schema` → `./schema`
- `packages/shared/src/utils/version-tree.ts` — change `$lib/types/workspace` → `../types/workspace`

**Important**: The DB layer uses `getRequestEvent()` from `$app/server` which is SvelteKit-specific. This needs to be refactored: the DB factory should accept platform env as a parameter instead of reaching into SvelteKit internals. The consuming app passes `platform.env` from its load/hook functions.

**Step 4: Create barrel export**

Create `packages/shared/src/index.ts`:

```ts
// Re-export commonly used items
export { getDb } from './db/index';
export * from './types/workspace';
```

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: create @zyeta/shared package with DB, config, types, utils, components"
```

---

### Task 3: Move editor engine files

**Files:**
- Move files from `src/lib/` to `packages/editor-engine/src/`
- Create: `packages/editor-engine/src/index.ts` (barrel export)

**Step 1: Move files**

```bash
cp src/lib/editor.svelte.ts packages/editor-engine/src/editor.svelte.ts
cp src/lib/server/ai/index.ts packages/editor-engine/src/server/ai/index.ts
cp src/lib/server/ai/types.ts packages/editor-engine/src/server/ai/types.ts
cp src/lib/server/ai/fal-editor.ts packages/editor-engine/src/server/ai/fal-editor.ts
cp src/lib/server/ai/fal-segmenter.ts packages/editor-engine/src/server/ai/fal-segmenter.ts
cp src/lib/server/ai/fal-config.ts packages/editor-engine/src/server/ai/fal-config.ts
cp src/lib/server/storage.ts packages/editor-engine/src/server/storage.ts
cp src/lib/components/EditorBar.svelte packages/editor-engine/src/components/EditorBar.svelte
cp src/lib/components/VersionTree.svelte packages/editor-engine/src/components/VersionTree.svelte
cp src/lib/components/CommandBar.svelte packages/editor-engine/src/components/CommandBar.svelte
cp src/lib/actions/mask-canvas.svelte.ts packages/editor-engine/src/actions/mask-canvas.svelte.ts
cp src/lib/utils/mask.ts packages/editor-engine/src/utils/mask.ts
```

**Step 2: Update imports**

Replace `$lib/` imports with relative paths or `@zyeta/shared` package imports:

- `editor.svelte.ts` — `$lib/types/workspace` → `@zyeta/shared/types`
- `server/ai/fal-editor.ts` — `$lib/server/ai/types` → `./types`, `$lib/server/ai/fal-config` → `./fal-config`
- `server/ai/fal-segmenter.ts` — same pattern
- `server/ai/fal-config.ts` — `$app/server` usage needs platform env parameter
- `server/storage.ts` — `$app/server` usage needs platform env parameter
- `components/EditorBar.svelte` — `$lib/editor.svelte` → `../editor.svelte`
- `components/VersionTree.svelte` — `$lib/types/workspace` → `@zyeta/shared/types`
- `actions/mask-canvas.svelte.ts` — `$lib/types/workspace` → `@zyeta/shared/types`, `$lib/utils/mask` → `../utils/mask`

**Step 3: Create server barrel export**

Create `packages/editor-engine/src/server/index.ts`:

```ts
export { createImageEditor, createImageSegmenter } from './ai/index';
export { persistImage } from './storage';
export { configureFal } from './ai/fal-config';
```

**Step 4: Create main barrel export**

Create `packages/editor-engine/src/index.ts`:

```ts
export { Editor } from './editor.svelte';
export type { MaskData } from '@zyeta/shared/types';
```

**Step 5: Commit**

```bash
git add packages/editor-engine/
git commit -m "feat: create @zyeta/editor-engine package with AI editor, components, actions"
```

---

### Task 4: Move world engine files

**Files:**
- Move files from `src/lib/components/` to `packages/world-engine/src/`
- Create: `packages/world-engine/src/index.ts`

**Step 1: Move files**

```bash
cp src/lib/components/IsometricScene.svelte packages/world-engine/src/IsometricScene.svelte
cp src/lib/components/scene/Scene.svelte packages/world-engine/src/scene/Scene.svelte
cp src/lib/components/scene/RoomModel.svelte packages/world-engine/src/scene/RoomModel.svelte
cp src/lib/components/scene/Avatar.svelte packages/world-engine/src/scene/Avatar.svelte
```

**Step 2: Update imports**

Scene components import from each other with relative paths — these should mostly work. Update any `$lib/` imports.

**Step 3: Create barrel export**

Create `packages/world-engine/src/index.ts`:

```ts
// Main re-exports
export { default as IsometricScene } from './IsometricScene.svelte';
```

**Step 4: Commit**

```bash
git add packages/world-engine/
git commit -m "feat: create @zyeta/world-engine package with Three.js isometric scene"
```

---

### Task 5: Create video engine package

**Files:**
- Create: `packages/video-engine/src/VideoStudio.svelte`
- Create: `packages/video-engine/src/index.ts`

The video engine is a new component extracted from the video route logic. It accepts images as props and handles the generate → film strip flow.

**Step 1: Create barrel export**

Create `packages/video-engine/src/index.ts`:

```ts
export { default as VideoStudio } from './VideoStudio.svelte';
```

**Step 2: Create VideoStudio component**

Create `packages/video-engine/src/VideoStudio.svelte` — a headless video generation component that:
- Accepts `images: Array<{ id: string; url: string; name: string }>` as a prop
- Accepts `apiEndpoint: string` (defaults to `/api/video`)
- Accepts `uploadEndpoint: string` (defaults to `/api/upload`)
- Handles all video generation state internally
- Renders storyboard, generate button, film strip, fullscreen modal
- Uses amber/orange accent colors

This can be extracted from the standalone `/video` route's `+page.svelte` if it exists, or written fresh matching the pattern from `src/routes/video/[tableId]/+page.svelte`.

**Step 3: Commit**

```bash
git add packages/video-engine/
git commit -m "feat: create @zyeta/video-engine package with VideoStudio component"
```

---

### Task 6: Move quest app routes and config

**Files:**
- Move all route files to `apps/quest/src/routes/`
- Move app-level files to `apps/quest/src/`
- Copy config files to `apps/quest/`

**Step 1: Move routes**

```bash
cp -r src/routes/* apps/quest/src/routes/
```

**Step 2: Move app-level files**

```bash
cp src/hooks.server.ts apps/quest/src/hooks.server.ts
cp src/app.html apps/quest/src/app.html
cp src/app.d.ts apps/quest/src/app.d.ts
cp src/lib/quest-engine.svelte.ts apps/quest/src/lib/quest-engine.svelte.ts
cp src/lib/toast.svelte.ts apps/quest/src/lib/toast.svelte.ts
```

**Step 3: Copy config files**

```bash
cp svelte.config.js apps/quest/svelte.config.js
cp vite.config.ts apps/quest/vite.config.ts
cp wrangler.jsonc apps/quest/wrangler.jsonc
cp tsconfig.json apps/quest/tsconfig.json
cp -r drizzle apps/quest/drizzle 2>/dev/null || true
cp drizzle.config.ts apps/quest/drizzle.config.ts 2>/dev/null || true
```

**Step 4: Update all `$lib/` imports in routes to use package imports**

In `apps/quest/src/routes/`:

Replace patterns like:
- `$lib/server/db/queries` → `@zyeta/shared/db/queries`
- `$lib/server/ai` → `@zyeta/editor-engine/server`
- `$lib/server/storage` → `@zyeta/editor-engine/server`
- `$lib/types/workspace` → `@zyeta/shared/types`
- `$lib/config/quest` → `@zyeta/shared/config/quest`
- `$lib/config/archetypes` → `@zyeta/shared/config/archetypes`
- `$lib/config/assets` → `@zyeta/shared/config/assets`
- `$lib/utils/edit-prompt` → `@zyeta/shared/utils/edit-prompt`
- `$lib/utils/version-tree` → `@zyeta/shared/utils/version-tree`
- `$lib/utils/download` → `@zyeta/shared/utils/download`
- `$lib/utils/mask` → `@zyeta/editor-engine/utils/mask`
- `$lib/editor.svelte` → `@zyeta/editor-engine/editor`
- `$lib/components/EditorBar.svelte` → `@zyeta/editor-engine/components/EditorBar`
- `$lib/components/VersionTree.svelte` → `@zyeta/editor-engine/components/VersionTree`
- `$lib/components/CommandBar.svelte` → `@zyeta/editor-engine/components/CommandBar`
- `$lib/components/BottomSheet.svelte` → `@zyeta/shared/components/BottomSheet`
- `$lib/components/CinematicModal.svelte` → `@zyeta/shared/components/CinematicModal`
- `$lib/components/Toast.svelte` → `@zyeta/shared/components/Toast`
- `$lib/components/IsometricScene.svelte` → `@zyeta/world-engine/IsometricScene`
- `$lib/components/scene/*` → `@zyeta/world-engine/scene/*`
- `$lib/actions/mask-canvas.svelte` → `@zyeta/editor-engine/actions/mask-canvas`

Keep `$lib/` imports that reference app-local files:
- `$lib/quest-engine.svelte` → stays as `$lib/quest-engine.svelte` (app-local)
- `$lib/toast.svelte` → stays as `$lib/toast.svelte` (app-local)

**Step 5: Commit**

```bash
git add apps/quest/
git commit -m "feat: move quest app routes and update import paths to workspace packages"
```

---

### Task 7: Create showcase app

**Files:**
- Create: `apps/showcase/src/app.html`
- Create: `apps/showcase/src/app.d.ts`
- Create: `apps/showcase/src/routes/+layout.svelte`
- Create: `apps/showcase/src/routes/+page.svelte`
- Create: `apps/showcase/svelte.config.js`
- Create: `apps/showcase/vite.config.ts`
- Create: `apps/showcase/tsconfig.json`
- Create: `apps/showcase/wrangler.jsonc`

**Step 1: Create app shell files**

`apps/showcase/src/app.html` — copy from quest app.

`apps/showcase/svelte.config.js` — same as quest but potentially different adapter config.

`apps/showcase/vite.config.ts` — same as quest.

`apps/showcase/tsconfig.json` — same as quest.

**Step 2: Create layout**

`apps/showcase/src/routes/+layout.svelte` — minimal layout with Tailwind CSS import.

**Step 3: Create home page**

`apps/showcase/src/routes/+page.svelte` — engine launcher with 3 cards (Editor, World, Video) linking to `/editor`, `/world`, `/video`.

**Step 4: Create engine demo routes**

- `apps/showcase/src/routes/editor/+page.svelte` — imports `<Editor />` from `@zyeta/editor-engine`
- `apps/showcase/src/routes/world/+page.svelte` — imports `<IsometricScene />` from `@zyeta/world-engine`
- `apps/showcase/src/routes/video/+page.svelte` — imports `<VideoStudio />` from `@zyeta/video-engine`

**Step 5: Commit**

```bash
git add apps/showcase/
git commit -m "feat: create showcase app with engine demo routes"
```

---

### Task 8: Refactor DB layer to accept platform env as parameter

**Files:**
- Modify: `packages/shared/src/db/index.ts`
- Modify: `packages/shared/src/db/queries.ts`

**Context**: Currently `queries.ts` uses `getRequestEvent()` from `$app/server` to access `platform.env.DB` internally. This couples the DB layer to SvelteKit. Refactor so the consuming app passes the DB instance or platform env explicitly.

**Step 1: Update `getDb()` to only accept explicit parameters**

Remove the `$app/server` import. `getDb(platform)` already accepts platform as a param — just make it required and remove the fallback that calls `getRequestEvent()`.

**Step 2: Update queries to accept db as parameter**

Change query functions from calling `getRequestEvent()` internally to accepting a `db` parameter:

```ts
// Before (coupled to SvelteKit)
export async function getWorkspace(tableId: number) {
  const db = getDb(getRequestEvent()?.platform);
  // ...
}

// After (decoupled)
export async function getWorkspace(db: ReturnType<typeof getDb>, tableId: number) {
  // ...
}
```

Or use a context/middleware pattern where the app sets up DB access per-request.

**Step 3: Update consuming code in quest app routes**

Routes now pass `db` to query functions from their `load()` or remote function context.

**Step 4: Commit**

```bash
git add packages/shared/ apps/quest/
git commit -m "refactor: decouple DB layer from SvelteKit's getRequestEvent"
```

---

### Task 9: Refactor AI/Storage layer to accept platform env

**Files:**
- Modify: `packages/editor-engine/src/server/ai/fal-config.ts`
- Modify: `packages/editor-engine/src/server/storage.ts`

**Context**: Same issue as DB — `fal-config.ts` and `storage.ts` use `getRequestEvent()` or `process.env` to access credentials. Refactor to accept env/credentials as parameters.

**Step 1: Update `configureFal()` to accept credentials explicitly**

```ts
// Before
export function configureFal() {
  const env = getRequestEvent()?.platform?.env;
  // ...
}

// After
export function configureFal(env: { FAL_API_KEY: string; CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_AI_GATEWAY_ID?: string }) {
  // ...
}
```

**Step 2: Update `persistImage()` to accept R2 bucket explicitly**

```ts
// Before
export async function persistImage(url: string) {
  const bucket = getRequestEvent()?.platform?.env?.R2_IMAGES;
  // ...
}

// After
export async function persistImage(url: string, bucket: R2Bucket, publicUrl: string) {
  // ...
}
```

**Step 3: Update consuming code in quest app**

Remote functions in `apps/quest/src/routes/forge/ai.remote.ts` pass env from `getRequestEvent()` to the editor-engine server functions.

**Step 4: Commit**

```bash
git add packages/editor-engine/ apps/quest/
git commit -m "refactor: decouple AI/storage layer from SvelteKit's getRequestEvent"
```

---

### Task 10: Clean up old src/ directory and verify builds

**Files:**
- Delete: `src/` directory (all files now live in packages/ and apps/)

**Step 1: Remove old src/ directory**

```bash
rm -rf src/
```

**Step 2: Install workspace dependencies**

```bash
bun install
```

**Step 3: Verify quest app builds**

```bash
cd apps/quest && bun run check
cd apps/quest && bun run build
```

Fix any import errors. Common issues:
- Missing `$lib` aliases (needs `svelte.config.js` paths config)
- Package exports not matching (fix `exports` field in package.json)
- Server-only imports leaking to client (add Vite `ssr.external` config)

**Step 4: Verify showcase app builds**

```bash
cd apps/showcase && bun run check
cd apps/showcase && bun run build
```

**Step 5: Run tests**

```bash
bun test
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: remove old src/ directory, complete monorepo migration"
```

---

## Execution Notes

**Task dependencies:**
- Tasks 1-5 can be done in parallel (scaffolding + file moves)
- Task 6 depends on Tasks 2-5 (needs packages to exist for imports)
- Task 7 depends on Tasks 2-5
- Tasks 8-9 can be done in parallel (decoupling refactors)
- Task 10 depends on all others

**Recommended team composition for agentic teams:**
- **Lead**: Coordinates, creates scaffold (Task 1), reviews
- **Shared-dev**: Task 2 + Task 8 (shared package + DB refactor)
- **Engine-dev**: Tasks 3, 4, 5 (all engine packages)
- **App-dev**: Tasks 6, 7 (quest app + showcase app)
- **Verifier**: Task 10 (cleanup + build verification)
