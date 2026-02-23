# Workspace Quest — Design Document

**Date:** 2026-02-23
**Status:** Approved

## Vision

A gamified workspace design app where users craft their ideal office through an interactive quest, AI-edit their chosen spaces, and explore them as floating islands in a connected 3D metaverse.

## Three-Phase Journey

### Phase 1: Quest (Progressive Reveal)

Binary-choice game engine. Users see two workspace images side by side and pick the one that resonates. Each choice narrows their style profile and unlocks the next pair. After ~7 rounds the quest converges on a curated set of spaces that define their workspace.

- 28 seed images (office/workspace layouts) in the option pool
- JSON-defined quest tree: each node has two image options + metadata tags
- Choices accumulate style tags (e.g. "warm", "open-plan", "biophilic")
- Final result: 4-5 selected spaces forming the user's workspace blueprint
- Route: `/quest`

### Phase 2: Forge (AI Edit)

Each selected space becomes an editable canvas. Users refine colors, furniture, lighting, and atmosphere through AI-powered inpainting.

- SAM2 segmentation for click-to-select regions
- fal.ai Flux Inpainting for targeted edits
- Version tree (existing editHistory DAG) tracks every iteration
- "Forge complete" triggers 3D generation via Trellis-2
- Route: `/forge/[spaceId]`

### Phase 3: World / Metaverse

Completed spaces become floating islands in a 3D world. Users explore with WASD avatar movement. Multiple users' islands connect via bridges into a shared metaverse.

- Each user's workspace is a floating island (GLB model on a platform)
- Islands arranged in a ring/cluster with bridge meshes connecting them
- Avatar walking (already built with Threlte)
- OrbitControls for camera, click-to-teleport between islands
- Shared world: all participants' islands visible simultaneously
- Route: `/world` (your island), `/metaverse` (connected islands)

## Routes

| Route              | Purpose                           |
| ------------------ | --------------------------------- |
| `/`                | Landing — start quest or rejoin   |
| `/quest`           | Progressive reveal binary choices |
| `/forge/[spaceId]` | AI-edit a chosen space            |
| `/world`           | Your completed floating island    |
| `/metaverse`       | All connected islands             |

## Data Model Changes

- Remove `tableId` concept — users identified by session/workspace ID
- Add `questProgress` table: userId, step, choiceA, choiceB, selected, tags
- Add `spaces` table: userId, imageUrl, glbUrl, status (quest/forging/complete)
- Keep `editHistory` for version tree in Forge phase
- Keep `workspaces` as the top-level container

## What to Keep

- Threlte scene components (Scene, RoomModel, Avatar) — adapt for floating islands
- AI layer (fal-editor, fal-segmenter, fal-3d, fal-config)
- R2 storage + `resolveImageForFal()` utility
- Drizzle ORM + D1/libSQL pattern
- Version tree architecture

## What to Delete

- `/table/[tableId]` route and all table-specific logic
- `/workshop/` route
- `/gallery/` route
- QR code generation
- Polling endpoints (`/api/poll`)
- Table config UI
- Presenter dashboard (replace with landing page)

## Technical Decisions

- **Quest engine**: Client-side state machine driven by a JSON quest definition. No server round-trips during the quest — choices saved at the end.
- **Floating islands**: Extend existing RoomModel with platform geometry (hexagonal island base, grass/rock textures). Bridge meshes connect adjacent islands.
- **Metaverse**: Real-time sync deferred. MVP loads all completed islands from DB and renders statically. Live multiplayer is a future enhancement.
- **Progressive reveal**: Svelte 5 transitions for card flip/slide animations between quest steps.

## Implementation Approach

Build with agentic teams for parallel development:

- Quest engine + UI
- Forge editor (adapt existing editor)
- World/metaverse scene (adapt existing Threlte components)
- Data model + API routes
- Cleanup of redundant code
