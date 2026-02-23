# Workspace Studio — Monorepo Extraction + Game Enhancement

**Date**: 2026-02-24
**Status**: Approved

## Overview

Two-phase plan:
- **Phase 0**: Extract editor/AI/3D/video into shared packages, create standalone editor app, convert to monorepo
- **Phase 1**: Enhance the game (personality engine, cinematic modals, seed content, polish)

## Design Principles
- Deterministic — no real-time infra, no polling, no WebSockets
- In control — works the same for 1 or 50 users
- Punchy — phase transitions are moments, not page loads
- Simple — minimal new infrastructure, maximum impact

---

# Phase 0: Monorepo Extraction

## Target Structure

```
workspace-studio/
├── apps/
│   ├── game/                    # Quest → Forge → World (current v2, stripped)
│   │   ├── src/
│   │   │   ├── routes/          # quest/, forge/, world/, metaverse/, api/
│   │   │   ├── lib/
│   │   │   │   ├── server/db/   # Game-specific schema + queries
│   │   │   │   └── config/      # Quest config, archetypes
│   │   │   └── app.d.ts
│   │   ├── svelte.config.js
│   │   ├── wrangler.jsonc
│   │   └── package.json
│   │
│   └── editor/                  # Standalone AI image editor
│       ├── src/
│       │   ├── routes/          # Single editor route, API routes
│       │   ├── lib/
│       │   │   └── server/db/   # Editor-specific schema (simpler)
│       │   └── app.d.ts
│       ├── svelte.config.js
│       ├── wrangler.jsonc
│       └── package.json
│
├── packages/
│   ├── ai/                      # AI client (fal.ai wrapper)
│   │   ├── src/
│   │   │   ├── editor.ts        # Image editing (Flux, Nano Banana Pro)
│   │   │   ├── segmenter.ts     # SAM2 segmentation
│   │   │   ├── video.ts         # MiniMax video generation
│   │   │   ├── glb.ts           # Trellis-2 3D generation
│   │   │   ├── storage.ts       # R2 persist helpers
│   │   │   ├── resolve.ts       # resolveImageForFal
│   │   │   └── types.ts         # Shared AI types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── editor-ui/               # Svelte editor components
│   │   ├── src/
│   │   │   ├── Editor.svelte.ts         # Editor state class
│   │   │   ├── CommandBar.svelte        # Prompt + mode + suggestions
│   │   │   ├── EditorBar.svelte         # Strength slider
│   │   │   ├── VersionTree.svelte       # Version tree UI
│   │   │   ├── BottomSheet.svelte       # Mobile drawer
│   │   │   ├── LayerBar.svelte          # Navigation bar
│   │   │   ├── mask-canvas.svelte.ts    # Canvas drawing action
│   │   │   ├── mask.ts                  # Mask generation utils
│   │   │   └── version-tree.ts          # Tree building utils
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── scene/                   # Three.js / Threlte 3D scene
│       ├── src/
│       │   ├── IsometricScene.svelte
│       │   ├── Scene.svelte
│       │   ├── RoomModel.svelte
│       │   └── Avatar.svelte
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                 # Workspace root (bun workspaces)
├── turbo.json                   # Turborepo config (optional, for build orchestration)
└── tsconfig.base.json           # Shared TS config
```

## Key Refactoring: Dependency Injection for AI Layer

The AI layer currently reads credentials from `getRequestEvent()` (SvelteKit-specific). Refactor to **accept config as parameters**:

```typescript
// packages/ai/src/editor.ts — BEFORE (SvelteKit-coupled)
export function createFalEditor(): ImageEditor {
  configureFal();  // reads from getRequestEvent()
  // ...
}

// packages/ai/src/editor.ts — AFTER (pure, injectable)
export interface FalConfig {
  apiKey: string;
  accountId?: string;
  gatewayId?: string;
}

export function createImageEditor(config: FalConfig): ImageEditor {
  fal.config({ credentials: config.apiKey, ...proxyConfig(config) });
  // ...
}
```

Each app creates a thin adapter that reads platform bindings and passes them to the shared package:

```typescript
// apps/game/src/lib/server/ai.ts
import { createImageEditor } from '@workspace-studio/ai';
import { getRequestEvent } from '$app/server';

export function getEditor() {
  const env = getRequestEvent()?.platform?.env;
  return createImageEditor({
    apiKey: env?.FAL_API_KEY ?? process.env.FAL_API_KEY!,
    accountId: env?.CLOUDFLARE_ACCOUNT_ID,
    gatewayId: env?.CLOUDFLARE_AI_GATEWAY_ID
  });
}
```

Same pattern for storage (R2 bucket injected), DB (D1/libSQL injected), etc.

## Shared Package Boundaries

| Package | Contains | Does NOT contain |
|---------|----------|-----------------|
| `@workspace-studio/ai` | fal.ai API calls, image resolution, storage helpers | SvelteKit imports, `getRequestEvent`, `command()` |
| `@workspace-studio/editor-ui` | Svelte components, Editor state class, canvas actions, utils | Server code, DB queries, API routes |
| `@workspace-studio/scene` | Threlte/Three.js scene components | Server code, data fetching |

## Standalone Editor App (`apps/editor/`)

A general-purpose AI image editor:

### Routes
| Route | Purpose |
|-------|---------|
| `/` | Upload or paste an image to start editing |
| `/edit/[imageId]` | Full editor (same UI as forge, reuses editor-ui package) |

### Features
- Upload any image (drag-drop, paste, file picker)
- AI edit with mask tools (draw, brush, polygon, magic wand)
- AI prompt-based editing (add, remove, modify)
- Version tree (branch and explore edit history)
- Generate 3D model from any image
- Generate video clip from any image
- Download results (edited image, GLB, video)
- No sessions, no quest, no game — just an editor

### DB Schema (simpler)
```
images: id, originalUrl, currentUrl, createdAt
editHistory: id, imageId, parentId, imageUrl, prompt, step, createdAt
```

### Cloudflare Bindings
Same as game app: D1 + R2 + FAL_API_KEY. Separate Wrangler config, separate D1 database.

## Migration Steps (Phase 0 Implementation Order)

1. **Create monorepo root** — `workspace-studio/`, move current code to `apps/game/`
2. **Extract `packages/ai/`** — Refactor fal-config to accept injected config, move AI files
3. **Extract `packages/editor-ui/`** — Move Svelte components, Editor class, actions, utils
4. **Extract `packages/scene/`** — Move Threlte components
5. **Wire `apps/game/`** — Update imports to use `@workspace-studio/*` packages
6. **Create `apps/editor/`** — New SvelteKit app using shared packages
7. **Verify both apps** — `bun run check` + `bun run lint` in both apps

---

# Phase 1: Game Enhancement

## 1. Quest Reduction (7 → 5 Steps)

### Drop
- Step 5 (Collaboration: War Room vs Training Room) — overlaps with Meeting
- Step 7 (Kitchen: Maker Kitchen vs Hydration Station) — least impactful category

### Keep (renumbered)
1. Workstation: Open Desk vs Structured Desk
2. Meeting: Small Huddle vs Project Room
3. Focus: Focus Room vs Phone Booth
4. Social: Lounge vs Pantry
5. Privacy: Open Lounge vs Quiet Pod

**Result**: 5 spaces to forge. Tighter pacing.

## 2. Personality Engine

### Dimensions (5)
| Dimension | Low end | High end |
|-----------|---------|----------|
| Focus | Social, open | Private, focused |
| Energy | Minimal, quiet | Rich, active |
| Scale | Intimate, 1:1 | Grand, group |
| Formality | Casual, lounge | Structured, professional |
| Craft | Quick, functional | Premium, curated |

### Choice → Dimension Mapping
```
Step 1 (Workstation):
  Open Desk    → Focus -1, Energy +1, Formality -1
  Structured   → Focus +1, Energy -1, Formality +1

Step 2 (Meeting):
  Small Huddle → Scale -1, Formality -1, Energy -1
  Project Room → Scale +1, Formality +1, Energy +1

Step 3 (Focus):
  Focus Room   → Focus +1, Scale -1, Craft +1
  Phone Booth  → Focus +1, Scale -1, Craft -1

Step 4 (Social):
  Lounge       → Energy +1, Formality -1, Craft +1
  Pantry       → Energy -1, Formality -1, Craft -1

Step 5 (Privacy):
  Open Lounge  → Focus -1, Energy +1, Scale +1
  Quiet Pod    → Focus +1, Energy -1, Scale -1
```

### Archetypes (8)
| Archetype | Key traits | Description |
|-----------|-----------|-------------|
| **The Architect** | High Focus + Formality | "You build spaces that think. Every surface has purpose." |
| **The Collaborator** | Low Focus + High Energy | "Your workspace is alive with conversation." |
| **The Minimalist** | High Focus + Low Energy | "Less is more. Silence is your greatest tool." |
| **The Curator** | High Craft + Formality | "Details matter. Every object is chosen." |
| **The Connector** | Low Focus + Low Formality | "Barriers? What barriers?" |
| **The Strategist** | High Focus + Scale | "Command rooms and war tables." |
| **The Creator** | High Craft + Energy | "Your workspace is a studio." |
| **The Explorer** | Balanced | "You defy categories." |

### Algorithm
1. Sum dimension scores from all 5 choices
2. Find top 2 dimensions (highest absolute values)
3. Match against archetype table (best fit)
4. Fallback: "The Explorer" if no strong signal

### Storage
- Add `archetype` TEXT column to `sessions` table
- Computed server-side in `saveQuest`, stored once

## 3. Cinematic Modals

### Shared Component: `CinematicModal.svelte`
- Full-screen overlay: black/90 + backdrop-blur-xl
- Content centered, max-w-lg
- Entry: fade (300ms) + scale (0.9→1.0, 500ms)
- No X button — must click CTA (intentional friction)
- Enter triggers CTA, Escape does nothing
- Body scroll locked

### Modal 1: Personality Reveal
**Trigger**: After quest step 5, before results grid.
1. Archetype icon — scale in (400ms)
2. "You are..." — fade in
3. Name — typewriter (40ms/char)
4. Description — fade in
5. 5 space thumbnails — stagger (80ms apart)
6. "Enter the Forge" — pulse-glow

### Modal 2: Space Forged
**Trigger**: After `completeSpace` succeeds.
1. Checkmark SVG draw-in (500ms)
2. "Space Forged" headline
3. Space image + emerald glow
4. "2 of 5 islands built" progress dots
5. CTA: "Forge Next" or "Enter Your World"

### Modal 3: World Unlocked
**Trigger**: First `/world` load with all spaces complete (localStorage flag).
1. Black (500ms)
2. Island count scales in
3. "Your World Is Complete"
4. Fades away, scene visible

## 4. Seed Content
- `/api/seed` POST (secret-key protected)
- 5-8 demo spaces from unused static assets
- `isSeed: true` flag on sessions table
- Lower sort priority than real user spaces

## 5. Game Feel Polish

### Quest
- Blur-in on new step images (200ms)
- Progress bar gradient shimmer
- Step counter animation

### Forge
- Entry transition: dark overlay → space name → "Preparing canvas..." → reveal
- Completion: button morphs to progress → Space Forged modal

### World
- New islands (last 5 min) get sparkle effect
- Camera starts zoomed in, slowly reveals all

## Data Model Changes
- `sessions`: Add `archetype TEXT`, `isSeed INTEGER DEFAULT 0`
- No other table changes

## What We're NOT Doing
- No real-time polling or WebSockets
- No presenter dashboard
- No leaderboard or voting
- No radar chart
- No live activity feed
