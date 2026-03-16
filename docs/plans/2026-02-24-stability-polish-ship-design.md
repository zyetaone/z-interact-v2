# Design: Stability + Polish + Ship

**Date**: 2026-02-24
**Goal**: Make the existing flow bulletproof (stability), feel good (polish), and production-ready (ship).
**Approach**: Three sequential waves. Each wave is one commit.

---

## Wave 1: Stability (P0/P1 bugs)

### 1.1 Quest double-submit idempotency

- **File**: `src/routes/quest/ai.remote.ts`
- **Problem**: Two concurrent `saveQuest()` calls both pass the `questCompleted` check, creating 10 spaces instead of 5.
- **Fix**: Use atomic `UPDATE sessions SET quest_completed=true WHERE id=? AND quest_completed=false`. If 0 rows affected, return existing spaces. Only the winner proceeds to create spaces.

### 1.2 Quest re-entry guard

- **File**: `src/routes/quest/+page.server.ts`
- **Problem**: User with completed quest can revisit `/quest` and see the quiz again.
- **Fix**: Check `session.questCompleted` in load. If true, redirect to `/`.

### 1.3 CSRF origin check

- **File**: `src/hooks.server.ts`
- **Problem**: No CSRF protection on mutation endpoints.
- **Fix**: For non-GET requests, verify `Origin` header matches `Host`. Return 403 on mismatch.

### 1.4 World arrange guard during completion

- **File**: `src/routes/world/+page.svelte`
- **Problem**: Opening Arrange panel while a space is completing can cause index mismatch.
- **Fix**: Disable Arrange button while `isCompleting !== null`.

### 1.5 Metaverse session-aware navigation

- **File**: `src/routes/metaverse/+page.svelte` + `+page.server.ts`
- **Problem**: "Your World" link sends session-less users to `/world` which redirects to `/`.
- **Fix**: Pass `hasSession` from server, conditionally show "Your World" vs "Start Quest" link.

---

## Wave 2: UX Polish

### 2.1 Toast notification system

- **Files**: NEW `src/lib/toast.svelte.ts` + NEW `src/lib/components/Toast.svelte`
- Reactive store using Svelte 5 runes. Auto-dismiss after configurable duration.
- Used for: session expiry, save success, errors.
- Rendered in `+layout.svelte`.

### 2.2 Quest exit visibility

- **File**: `src/routes/quest/+page.svelte`
- Add top-left back/home link visible during quiz steps (not just bottom).

### 2.3 Forge navigation guard

- **File**: `src/routes/forge/[spaceId]/+page.svelte`
- `beforeNavigate` warning if mask drawn or AI generation in progress.

### 2.4 Session expiry feedback

- **Files**: `src/routes/+page.svelte`, `src/routes/+page.server.ts`
- Server sets `?expired=1` on redirect after stale session clear.
- Landing page shows toast: "Session ended. Start a new quest."

### 2.5 World completion animation

- **File**: `src/routes/world/+page.svelte`
- Better feedback when "Add" completes: scale-in transition on new island card.

---

## Wave 3: Ship Prep

### 3.1 Global error page

- **File**: NEW `src/routes/+error.svelte`
- Clean dark-themed error page with message + "Go Home" button.

### 3.2 Session cleanup endpoint

- **File**: NEW `src/routes/api/cleanup/+server.ts`
- DELETE endpoint that removes sessions older than 30 days + cascading data.
- Protected by `X-Cleanup-Key` header matching env secret.

### 3.3 Remove dead GLB code

- **Files**: `src/lib/server/ai/fal-3d.ts` (delete), `src/lib/server/storage.ts` (remove persistGlb), `src/lib/server/ai/index.ts` (remove re-exports), `src/lib/server/db/queries.ts` (remove glbUrl from updateSpace type)
