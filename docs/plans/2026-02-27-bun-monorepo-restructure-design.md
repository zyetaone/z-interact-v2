# Bun Monorepo Restructure Design

## Problem

workspace-studio-v2 is a single SvelteKit app (~6,800 lines) that bundles everything together: the Workspace DNA quest journey, AI image editor, 3D world viewer, and video engine. The editor engine in particular is a valuable standalone concept that should be reusable across multiple apps (studio, showcases, future products). The current structure makes it impossible to use any engine independently.

## Design

### Structure

```
workspace-studio-v2/
├── package.json                    # Bun workspace root
├── bunfig.toml                     # Bun workspace config
├── tsconfig.json                   # Shared TS config (base)
│
├── packages/
│   ├── shared/                     # @zyeta/shared
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── db/                 # schema.ts, queries.ts, index.ts
│   │       ├── config/             # quest.ts, archetypes.ts, assets.ts
│   │       ├── types/              # workspace.ts (MaskData, Version, etc.)
│   │       ├── components/         # Toast.svelte, CinematicModal.svelte, BottomSheet.svelte
│   │       └── utils/              # edit-prompt.ts, download.ts, version-tree.ts
│   │
│   ├── editor-engine/              # @zyeta/editor-engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Public API exports
│   │       ├── Editor.svelte       # Main entry component
│   │       ├── editor.svelte.ts    # Editor class (reactive state)
│   │       ├── server/             # AI factory, storage, fal-editor, fal-segmenter, fal-config
│   │       ├── components/         # EditorBar, VersionTree, CommandBar
│   │       ├── actions/            # mask-canvas.svelte.ts
│   │       └── utils/              # mask.ts
│   │
│   ├── world-engine/               # @zyeta/world-engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Public API exports
│   │       ├── World.svelte        # Main entry component
│   │       └── scene/              # Scene.svelte, IsometricScene.svelte, RoomModel.svelte, Avatar.svelte
│   │
│   └── video-engine/               # @zyeta/video-engine
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Public API exports
│           └── VideoStudio.svelte  # Main entry component (upload + generate + film strip)
│
├── apps/
│   ├── quest/                      # Main "Workspace DNA" app
│   │   ├── package.json
│   │   ├── svelte.config.js
│   │   ├── vite.config.ts
│   │   ├── wrangler.jsonc
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app.html
│   │       ├── app.d.ts
│   │       ├── routes/
│   │       │   ├── +layout.svelte
│   │       │   ├── +page.svelte         # Landing / returning user dashboard
│   │       │   ├── +page.server.ts
│   │       │   ├── quest/               # 5-step quiz
│   │       │   ├── forge/[spaceId]/     # Uses <Editor /> from @zyeta/editor-engine
│   │       │   ├── world/               # Uses <World /> from @zyeta/world-engine
│   │       │   ├── metaverse/           # Shared gallery
│   │       │   └── api/                 # upload, r2 proxy, reorder, session, cleanup, seed
│   │       └── lib/
│   │           ├── quest-engine.svelte.ts  # Quest-specific state (stays in app)
│   │           └── toast.svelte.ts         # App-level toast (stays in app)
│   │
│   └── showcase/                   # Standalone engine demo app
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       ├── wrangler.jsonc
│       ├── tsconfig.json
│       └── src/
│           ├── app.html
│           ├── app.d.ts
│           └── routes/
│               ├── +layout.svelte
│               ├── +page.svelte         # Engine launcher (3 cards)
│               ├── editor/              # Editor engine demo
│               ├── world/               # World engine demo
│               └── video/               # Video engine demo
```

### Package Dependencies

```
@zyeta/shared          → drizzle-orm, @libsql/client, valibot (no Svelte dep for DB/types)
@zyeta/editor-engine   → @zyeta/shared, svelte, @fal-ai/client
@zyeta/world-engine    → @zyeta/shared, svelte, three, @threlte/core, @threlte/extras
@zyeta/video-engine    → @zyeta/shared, svelte
apps/quest             → @zyeta/shared, @zyeta/editor-engine, @zyeta/world-engine, sveltekit
apps/showcase          → @zyeta/shared, @zyeta/editor-engine, @zyeta/world-engine, @zyeta/video-engine, sveltekit
```

### Root package.json

```json
{
  "name": "workspace-studio-v2",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "bun run --filter apps/quest dev",
    "dev:showcase": "bun run --filter apps/showcase dev",
    "build": "bun run --filter apps/* build",
    "check": "bun run --filter '*' check",
    "test": "bun run --filter '*' test",
    "lint": "bun run --filter '*' lint"
  }
}
```

### Server Code Strategy

SvelteKit's `$lib/server` auto-treeshaking doesn't apply to external packages. For server-only code in packages:

1. **Subpath exports** in package.json:
   ```json
   {
     "exports": {
       ".": "./src/index.ts",
       "./server": "./src/server/index.ts"
     }
   }
   ```

2. **Consuming apps import server code explicitly:**
   ```ts
   // In forge/ai.remote.ts
   import { createImageEditor } from '@zyeta/editor-engine/server';
   ```

3. **Vite config** in each app ensures server subpaths are excluded from client bundle via `ssr.external` or conditional imports.

### Cloudflare Bindings

Each app has its own `wrangler.jsonc` with its own D1 database and R2 bucket. They can share the same D1/R2 in production (same binding names) or use separate ones.

The `@zyeta/shared` DB layer accepts `platform.env` as a parameter — the consuming app passes it in from its SvelteKit hooks/load functions.

### Migration Path

The restructure is a move operation, not a rewrite:
1. Create workspace structure (root package.json, directories)
2. Move files from `src/lib/` into appropriate packages
3. Move routes into `apps/quest/src/routes/`
4. Update all import paths (from `$lib/` to `@zyeta/` package imports)
5. Create `apps/showcase/` (thin app importing engine packages)
6. Verify builds for both apps

### What Stays in Each App vs Package

| Code | Location | Reason |
|------|----------|--------|
| DB schema + queries | `@zyeta/shared` | All apps need DB access |
| Types (MaskData, Version) | `@zyeta/shared` | All engines use these |
| Config (quest, archetypes) | `@zyeta/shared` | Quest app + showcase need these |
| Toast, Modal components | `@zyeta/shared` | Generic UI used everywhere |
| Editor class + components | `@zyeta/editor-engine` | The "Photoshop" engine |
| AI factory + fal adapters | `@zyeta/editor-engine` | Coupled to editor operations |
| Storage (R2 persist) | `@zyeta/editor-engine` | Image persistence for edits |
| Scene components | `@zyeta/world-engine` | Three.js 3D rendering |
| Video generation UI | `@zyeta/video-engine` | Image-to-video pipeline |
| QuestEngine class | `apps/quest` | App-specific state |
| toast.svelte.ts | `apps/quest` | App-level notification |
| Route handlers | `apps/quest` | App-specific wiring |
| API routes | `apps/quest` | App-specific endpoints |

## Non-Goals

- Not moving v1 into this monorepo (stays separate)
- Not changing the database schema
- Not changing the AI layer implementation
- Not adding new features — pure restructure
