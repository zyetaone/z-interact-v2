# Engine / Workshop Separation Design

## Problem

The app conflates two distinct concerns:

- **Engines** — standalone POC demos for evaluating which AI concept works in a presentation (Edit, 3D World, Video)
- **Workshop** — the seminar deployment with tables, QR codes, gallery, and lock flow

Currently, engines are tangled into workshop routes (`/table/[tableId]`, `/video/[tableId]`), making it hard to evaluate them independently.

## Design

### Route Map

| Route                | Type       | Purpose                                             |
| -------------------- | ---------- | --------------------------------------------------- |
| `/`                  | Engine Hub | 3 engine cards + Workshop Mode link                 |
| `/editor`            | Engine     | Standalone image editor (tableId=0)                 |
| `/world`             | Engine     | 3D isometric scene (already standalone)             |
| `/video`             | Engine     | **NEW** — standalone video from any images          |
| `/workshop`          | Workshop   | **NEW** — old QR dashboard (redirect to `/gallery`) |
| `/table/[tableId]`   | Workshop   | Per-table editor (unchanged)                        |
| `/video/[tableId]`   | Workshop   | Per-table video journey (unchanged)                 |
| `/gallery`           | Workshop   | Gallery grid (unchanged)                            |
| `/gallery/[tableId]` | Workshop   | Gallery detail (unchanged)                          |

### Home Page Changes

Add a 3rd section for **Video Engine** (amber/orange accent) between 3D World and a new Workshop Mode link at the bottom. Video section matches the existing full-bleed immersive style.

Add a **Workshop Mode** link at the bottom — a subtle CTA linking to `/workshop` for the seminar flow.

### New `/video` Route

A fork of `/video/[tableId]/+page.svelte` but:

- No tableId dependency — user uploads/provides images directly
- Drop-zone or URL paste for source images
- Self-contained storyboard from uploaded images
- No `getWorkspace` / `getEditHistory` calls
- Uses the same `/api/video` endpoint for generation

### New `/workshop` Route

Minimal — just redirects to `/gallery` (matching the original home page behavior before the launcher rewrite). This preserves the seminar workflow where the presenter goes to the dashboard/gallery.

### Layout Updates

- `/video` (engine) gets `isVideoEngineRoute` — hide nav (immersive like other engines)
- `/workshop` shows nav (it's part of the workshop flow)
- Nav "Dashboard" link updates to point to `/workshop` instead of `/`

## Files to Create/Modify

| File                               | Action                                            |
| ---------------------------------- | ------------------------------------------------- |
| `src/routes/+page.svelte`          | MODIFY — add Video section + Workshop link        |
| `src/routes/video/+page.svelte`    | CREATE — standalone video engine                  |
| `src/routes/video/+page.server.ts` | CREATE — empty load (no DB dependency)            |
| `src/routes/workshop/+page.svelte` | CREATE — redirect to /gallery                     |
| `src/routes/+layout.svelte`        | MODIFY — add isVideoEngineRoute, update nav links |

## Non-Goals

- No changes to existing workshop routes (`/table/[tableId]`, `/video/[tableId]`, `/gallery/*`)
- No changes to the editor engine (`/editor`) — already standalone
- No changes to the 3D world engine (`/world`) — already standalone
- No new database tables or API endpoints
