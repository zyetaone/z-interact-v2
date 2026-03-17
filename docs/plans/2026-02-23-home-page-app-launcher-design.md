# Home Page App Launcher + Standalone Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the home page with an immersive 2-section app launcher (Edit Engine + 3D World) and create a standalone `/editor` route that works independently of the workshop table system.

**Architecture:** The `/editor` route reuses the existing editor infrastructure (Workspace class, Editor, Viewer, CommandBar) with `tableId=0` as a dedicated demo/sandbox key. Validation is expanded to accept 0. The home page becomes a full-bleed scroll-through showcase.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Tailwind CSS 4, Lucide icons, existing glass morphism design system.

---

## Task 1: Expand validation to accept tableId=0

**Files:**

- Modify: `src/lib/config/tables.ts`
- Modify: `src/routes/table/ai.remote.ts` (lines 51, 122, 136)
- Modify: `src/routes/api/workspace/+server.ts` (line 22)

**Step 1: Add EDITOR_TABLE_ID constant and expand isValidTableId**

In `src/lib/config/tables.ts`:

```typescript
export const TABLE_COUNT = 10;
export const EDITOR_TABLE_ID = 0;
export const MAX_EDITS_PER_TABLE = 20;

export function isValidTableId(tableId: number): boolean {
	return Number.isInteger(tableId) && tableId >= 0 && tableId <= TABLE_COUNT;
}
```

**Step 2: Update Valibot schemas in ai.remote.ts**

Change all `v.minValue(1)` to `v.minValue(0)` in three schemas:

- `EditImageSchema.tableId` (line 51)
- `deleteImage` schema (line 122)
- `LockImageSchema.tableId` (line 136)

**Step 3: Verify build**

Run: `npx svelte-check`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/lib/config/tables.ts src/routes/table/ai.remote.ts src/routes/api/workspace/+server.ts
git commit -m "feat: expand validation to accept tableId=0 for standalone editor"
```

---

## Task 2: Add basePath to Workspace class

**Files:**

- Modify: `src/routes/table/[tableId]/workspace.svelte.ts` (lines 73, 110, 121, 123)

**Step 1: Add basePath parameter to constructor**

Change the constructor to accept a `basePath` option:

```typescript
constructor(
    public data: {
        tableId: number;
        workspace?: { ... } | null;
        history?: Version[];
    },
    public basePath: string = `/table/${data.tableId}`
) {
```

**Step 2: Replace all hardcoded `/table/${this.data.tableId}` with `this.basePath`**

4 occurrences to update:

- `createWorkspace`: `pushState(this.basePath, {});`
- `generate`: `pushState(\`${this.basePath}?node=${newVersion.id}\`, { node: newVersion.id });`
- `activate` (versionId truthy): `pushState(\`${this.basePath}?node=${versionId}\`, { node: versionId });`
- `activate` (else): `pushState(this.basePath, {});`

**Step 3: Verify existing table pages still work**

Run: `npx svelte-check`
Expected: 0 errors (default basePath preserves existing behavior)

**Step 4: Commit**

```bash
git add src/routes/table/[tableId]/workspace.svelte.ts
git commit -m "refactor: add basePath to Workspace class for URL flexibility"
```

---

## Task 3: Create standalone editor route

**Files:**

- Create: `src/routes/editor/+page.server.ts`
- Create: `src/routes/editor/+page.svelte`

**Step 1: Create editor page server load**

`src/routes/editor/+page.server.ts`:

```typescript
import { EDITOR_TABLE_ID } from '$lib/config/tables';
import { getWorkspace, getEditHistory } from '$lib/server/db/queries';
import { ASSET_IMAGES } from '$lib/config/assets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [workspace, history] = await Promise.all([
		getWorkspace(EDITOR_TABLE_ID),
		getEditHistory(EDITOR_TABLE_ID)
	]);

	return {
		tableId: EDITOR_TABLE_ID,
		workspace: workspace ?? null,
		history,
		assetImages: ASSET_IMAGES
	};
};
```

**Step 2: Create editor page component**

`src/routes/editor/+page.svelte` — Fork of `/table/[tableId]/+page.svelte` with these changes:

1. Import Workspace from `../table/[tableId]/workspace.svelte.ts`
2. Import Viewer from `../table/[tableId]/viewer.svelte.ts`
3. Import segmentObject from `../table/ai.remote`
4. Pass `basePath='/editor'` to Workspace constructor: `new Workspace(data, '/editor')`
5. Header: "Edit Engine" instead of "Table {data.tableId}"
6. Back button href: `/` (home) instead of `/` (same, but semantic)
7. Remove "Lock & Submit" button and success celebration modal
8. Remove "Powered by ZyetAI" footer
9. Remove Film/Create Journey link (editor is standalone)
10. LayerBar: `activeLayer="canvas"`, `tableId={null}`, video unavailable

The page is ~780 lines. The fork keeps the same canvas, tool selector, comparison slider, BottomSheet, CommandBar, EditorBar, and VersionTree — just strips workshop-specific features.

**Step 3: Verify build**

Run: `npx svelte-check`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/routes/editor/
git commit -m "feat: add standalone /editor route for presentation mode"
```

---

## Task 4: Update layout to hide nav on home and editor routes

**Files:**

- Modify: `src/routes/+layout.svelte`

**Step 1: Add editor and home route detection**

Add to the existing derived state block:

```typescript
const isEditorRoute = $derived(page.url.pathname.startsWith('/editor'));
const isHomeRoute = $derived(page.url.pathname === '/' || page.url.pathname === base + '/');
const showNav = $derived(!isTableRoute && !isWorldRoute && !isEditorRoute && !isHomeRoute);
```

This hides the top nav on the immersive home page and the standalone editor.

**Step 2: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: hide top nav on home and editor routes"
```

---

## Task 5: Replace home page with immersive app launcher

**Files:**

- Rewrite: `src/routes/+page.svelte`
- Simplify: `src/routes/+page.server.ts`

**Step 1: Simplify server load**

`src/routes/+page.server.ts` — No longer needs table data:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {};
};
```

**Step 2: Rewrite home page**

`src/routes/+page.svelte` — Full-bleed immersive launcher with 2 stacked hero sections:

Structure:

```
div.min-h-screen.bg-slate-950
├── Header (fixed top, glass, z-30)
│   └── ZyetaDX Studio branding + Gallery/Dashboard links
├── Section 1: Edit Engine (~50vh)
│   ├── Blurred background image (from /assets/)
│   ├── Gradient overlay
│   ├── Glass content card (title, subtitle, feature pills, CTA button)
│   └── CTA → /editor
└── Section 2: 3D World (~50vh)
    ├── Dark gradient background with grid pattern
    ├── Glass content card
    └── CTA → /world
```

Styling follows existing patterns:

- `.glass` and `.glass-panel` classes
- Purple accent colors (`bg-purple-500/20`, `text-purple-300`)
- `.fade-in`, `.slide-up`, `.zoom-in` animations
- Lucide icons: `PenTool` for edit, `Globe` for 3D

Feature pills for Edit Engine: "AI Inpainting", "Mask Painting", "Version Tree", "Before/After"
Feature pills for 3D World: "Isometric Scene", "Room Explorer", "Avatar Walk", "3D Generation"

**Step 3: Verify build**

Run: `npx svelte-check && bun run build`
Expected: 0 errors, build succeeds

**Step 4: Commit**

```bash
git add src/routes/+page.svelte src/routes/+page.server.ts
git commit -m "feat: replace home page with immersive app launcher"
```

---

## Task 6: Final verification

**Step 1: Full build check**

Run: `bun run build`
Expected: Success

**Step 2: Visual check list**

- [ ] Home page shows 2 immersive hero sections
- [ ] "Edit Engine" CTA navigates to `/editor`
- [ ] "3D World" CTA navigates to `/world`
- [ ] Editor loads, accepts image upload, AI editing works
- [ ] LayerBar visible on editor page
- [ ] Top nav hidden on home and editor pages
- [ ] Existing `/table/[tableId]` routes still work unchanged

---

## File Summary

| File                                             | Action                          | Lines ~est     |
| ------------------------------------------------ | ------------------------------- | -------------- |
| `src/lib/config/tables.ts`                       | MODIFY                          | +2             |
| `src/routes/table/ai.remote.ts`                  | MODIFY                          | 3 line changes |
| `src/routes/api/workspace/+server.ts`            | unchanged (uses isValidTableId) | 0              |
| `src/routes/table/[tableId]/workspace.svelte.ts` | MODIFY                          | +5             |
| `src/routes/editor/+page.server.ts`              | CREATE                          | ~20            |
| `src/routes/editor/+page.svelte`                 | CREATE                          | ~650           |
| `src/routes/+layout.svelte`                      | MODIFY                          | +3             |
| `src/routes/+page.svelte`                        | REWRITE                         | ~150           |
| `src/routes/+page.server.ts`                     | SIMPLIFY                        | ~5             |
