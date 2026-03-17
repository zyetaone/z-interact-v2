# Cinematic Journey + Isometric World — Design Doc

**Date**: 2026-02-20
**Status**: Approved

## Overview

Extend workspace-studio-v2 with two major features:

1. **Cinematic Journey** (`/video/[tableId]`) — Per-user brand-film-style video from their edit iterations
2. **Isometric World** (`/world`) — Interactive Three.js scene combining all workspace designs as 3D rooms

## Architecture

### Two Teams

**Team 1: studio-backend** (AI + API)

- `fal-3d.ts` — Trellis-2 image-to-3D GLB ($0.25/model, ~15s)
- `fal-video.ts` — MiniMax image-to-video with cinematic prompts ($0.50/clip)
- `/api/iso` POST/GET — 3D generation + retrieval
- `/api/video` — Enhanced with cinematic prompt variants
- DB schema update — `glbUrl` column on workspaces table

**Team 2: studio-frontend** (Routes + Three.js)

- `/video/[tableId]` — Cinematic journey page with storyboard timeline
- `/world` — Three.js isometric world with progressive interactivity
- `IsometricScene.svelte` — Three.js wrapper component
- Editor sidebar "Create Journey" button

### New Dependency

- `three` + `@types/three`

## Feature 1: Cinematic Journey (`/video/[tableId]`)

### User Flow

1. User has 2+ edit iterations on their workspace
2. Clicks "Create Journey" in editor sidebar → navigates to `/video/[tableId]`
3. Page shows storyboard timeline of all versions
4. "Generate Film" → MiniMax creates 5s cinematic clip per version
5. Clips presented as film strip with auto-play preview
6. "Download Reel" for full sequence

### Cinematic Prompts (cycled)

- `[Slow zoom in] Architectural workspace reveal, dramatic lighting, cinematic DOF`
- `[Push in] Design transformation, smooth camera push, professional atmosphere`
- `[Pan left] Workspace evolution, golden hour lighting, editorial quality`
- `[Tracking shot] Interior design showcase, steady cam, magazine aesthetic`
- `[Pedestal up] Elegant office space, rising perspective, architectural beauty`

### Server

- Reuse `fal-video.ts` with cinematic-specific prompt templates
- Store video URLs in edit_history table (new `videoUrl` column) or return transiently

## Feature 2: Isometric World (`/world`)

### Progressive Layers

**Layer 1 — Isometric Grid**

- Three.js OrthographicCamera (isometric projection: rotation 45deg, tilt 30deg)
- Each locked workspace → Trellis-2 → GLB in R2
- GLTFLoader loads models, positions on NxM grid
- Auto-orbit, scroll zoom, table labels

**Layer 2 — Click-to-Explore**

- Click room → smooth camera tween (GSAP or manual lerp)
- Info panel: table number, edit count, prompt history
- "Back" returns to overview
- Arrow key navigation between rooms

**Layer 3 — Avatar Walk (stretch)**

- Sprite character on isometric plane
- WASD movement with smooth interpolation
- Room entry triggers explore view
- Optional: show connected users as dots

### 3D Generation Flow

1. POST `/api/iso` { imageUrl } → Trellis-2 → GLB → R2 → return URL
2. GET `/api/iso` → all { tableId, glbUrl } pairs
3. `workspaces.glbUrl` column tracks generation status

### Three.js Component (`IsometricScene.svelte`)

- Svelte 5 action or onMount-based Three.js initialization
- Responsive canvas sizing
- Progressive loading with placeholder cubes
- OrbitControls for Layer 1, custom controls for Layer 2/3

## DB Schema Changes

```sql
ALTER TABLE workspaces ADD COLUMN glb_url TEXT;
```

## File Map

```
src/
├── lib/server/ai/
│   ├── fal-3d.ts              (NEW — Trellis-2 wrapper)
│   ├── fal-video.ts           (EXISTING — add cinematic prompts)
│   └── index.ts               (UPDATE — export 3D functions)
├── routes/
│   ├── api/iso/+server.ts     (NEW — 3D generation endpoint)
│   ├── api/video/+server.ts   (UPDATE — cinematic variants)
│   ├── video/[tableId]/
│   │   ├── +page.server.ts    (NEW — load version history)
│   │   └── +page.svelte       (NEW — cinematic journey page)
│   ├── world/
│   │   ├── +page.server.ts    (NEW — load all GLB URLs)
│   │   └── +page.svelte       (NEW — Three.js isometric world)
│   └── table/[tableId]/
│       └── +page.svelte       (UPDATE — "Create Journey" button)
└── lib/components/
    └── IsometricScene.svelte   (NEW — Three.js wrapper)
```
