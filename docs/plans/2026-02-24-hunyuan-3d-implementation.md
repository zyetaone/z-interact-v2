# Hunyuan 3D Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace disabled Trellis-2 with Hunyuan 3D v3.1 Rapid (image-to-3D) so completed spaces generate GLB models displayed in the World scene.

**Architecture:** Swap one fal.ai endpoint, wire GLB generation into the synchronous `completeSpace` command, persist to R2, and render via Threlte's `<GLTF>` component with room-corner fallback.

**Tech Stack:** SvelteKit 2, Svelte 5, fal.ai client, Threlte 8 (`@threlte/extras` GLTF), Three.js, Drizzle ORM, Cloudflare R2

---

### Task 1: Swap fal-3d.ts to Hunyuan 3D

**Files:**

- Modify: `src/lib/server/ai/fal-3d.ts`

**Step 1: Update the endpoint and input**

Replace the entire `generateGlb` function body. The Hunyuan 3D response has the same `model_glb.url` shape but uses `input_image_url` instead of `image_url`, and adds `enable_pbr: true`.

```typescript
// src/lib/server/ai/fal-3d.ts — full file replacement
import { fal } from '@fal-ai/client';
import { configureFal } from './fal-config';

export interface GlbGenerateRequest {
	imageUrl: string;
}

export interface GlbGenerateResult {
	glbUrl: string;
}

/**
 * Generate a GLB 3D model from a single image using Hunyuan 3D v3.1 Rapid.
 * Input: workspace image URL (must be HTTPS — use resolveImageForFal first).
 * Output: GLB model URL from fal.ai (temporary — persist to R2 before returning to client).
 */
export async function generateGlb(request: GlbGenerateRequest): Promise<GlbGenerateResult> {
	configureFal();

	const result = await fal.subscribe('fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d', {
		input: {
			input_image_url: request.imageUrl,
			enable_pbr: true
		}
	});

	const resultData = result.data as { model_glb?: { url: string } };
	if (!resultData.model_glb?.url) {
		throw new Error('No GLB model returned from Hunyuan 3D');
	}

	return { glbUrl: resultData.model_glb.url };
}
```

**Step 2: Verify types**

Run: `bun run check 2>&1 | grep -E "error|ERROR" | head -20`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/server/ai/fal-3d.ts
git commit -m "feat: swap Trellis-2 for Hunyuan 3D v3.1 Rapid image-to-3d"
```

---

### Task 2: Wire GLB generation into completeSpace

**Files:**

- Modify: `src/routes/forge/ai.remote.ts:129-147`

**Step 1: Add imports**

At the top of `ai.remote.ts` (line 4), add the new imports:

```typescript
import { persistImage, persistGlb } from '$lib/server/storage';
import { generateGlb, resolveImageForFal } from '$lib/server/ai/index';
```

Note: `persistImage` is already imported on line 4. Merge the import to:

```typescript
import { persistImage, persistGlb } from '$lib/server/storage';
```

And add a new line:

```typescript
import { generateGlb, resolveImageForFal } from '$lib/server/ai/index';
```

**Step 2: Replace the completeSpace command**

Replace lines 129-147 with:

```typescript
export const completeSpace = command(CompleteSpaceSchema, async (data) => {
	const event = getRequestEvent();
	const sessionId = event?.cookies.get('session_id');
	if (!sessionId) throw new Error('Unauthorized');

	const space = await getSpace(data.spaceId);
	if (!space) throw new Error('Space not found');
	if (space.sessionId !== sessionId) throw new Error('Forbidden');

	if (space.status === 'complete') {
		return { space };
	}

	// Generate 3D model from workspace image (graceful degradation on failure)
	let glbUrl: string | null = null;
	try {
		const falImageUrl = await resolveImageForFal(space.currentImageUrl);
		const glbResult = await generateGlb({ imageUrl: falImageUrl });
		glbUrl = await persistGlb(glbResult.glbUrl);
	} catch {
		// GLB generation failed — space still completes, World shows room corner fallback
		console.warn(`GLB generation failed for space ${data.spaceId}, completing without 3D model`);
	}

	const updatedSpace = await updateSpace(data.spaceId, {
		status: 'complete',
		glbUrl
	});

	return { space: updatedSpace };
});
```

**Step 3: Verify the updateSpace call accepts glbUrl**

Check `queries.ts` — `updateSpace` should accept `Partial<Space>` or at minimum `{ status, glbUrl }`. Read the function to confirm:

```bash
grep -A 10 "export async function updateSpace" src/lib/server/db/queries.ts
```

If `updateSpace` uses Drizzle's `.set(data)` with a partial type, this works out of the box since `glbUrl` is a column on the `spaces` table.

**Step 4: Verify types**

Run: `bun run check 2>&1 | grep -E "error|ERROR" | head -20`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/routes/forge/ai.remote.ts
git commit -m "feat: generate GLB via Hunyuan 3D during space completion"
```

---

### Task 3: Re-add glbUrl state to ForgeWorkspace

**Files:**

- Modify: `src/routes/forge/forge-workspace.svelte.ts:21-34,152-169`

**Step 1: Add glbUrl state property**

After line 24 (`status = $state<'forging' | 'complete'>('forging');`), add:

```typescript
glbUrl = $state<string | null>(null);
```

**Step 2: Initialize from constructor**

In the constructor (after line 78: `this.status = ...`), add:

```typescript
this.glbUrl = init.space.glbUrl ?? null;
```

**Step 3: Update complete() method**

Replace the `complete()` method (lines 152-169) with:

```typescript
async complete() {
	if (this.isProcessing || this.status === 'complete') return;
	this.isProcessing = true;
	this.errorMessage = '';

	try {
		const result = await completeSpace({ spaceId: this.spaceId });
		this.status = 'complete';
		this.glbUrl = result.space?.glbUrl ?? null;
		this.allSpaces = this.allSpaces.map((s) =>
			s.id === this.spaceId ? { ...s, status: 'complete' } : s
		);
		this.showCompletionModal = true;
	} catch (e) {
		this.errorMessage = e instanceof Error ? e.message : 'Failed to complete space';
	} finally {
		this.isProcessing = false;
	}
}
```

**Step 4: Verify types**

Run: `bun run check 2>&1 | grep -E "error|ERROR" | head -20`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/routes/forge/forge-workspace.svelte.ts
git commit -m "feat: re-add glbUrl state to forge workspace"
```

---

### Task 4: Update forge page completion UI

**Files:**

- Modify: `src/routes/forge/[spaceId]/+page.svelte`

**Step 1: Update processing text for 3D generation**

The completion flow now takes ~15-30s for 3D generation. Update the spinner text in the sidebar (line 526) and mobile (line 658) from "Completing space..." to "Generating 3D model...":

Find all occurrences of:

```
Completing space...
```

Replace with:

```
Generating 3D model...
```

There are 4 occurrences (lines 526, 542, 658, 674).

**Step 2: Update the completion state message**

Line 268-269, update the description:

```html
<p class="mt-2 text-slate-400">
	Your space has been transformed into a 3D island. View it in the World.
</p>
```

**Step 3: Verify and format**

Run: `bun run lint`
Expected: clean

**Step 4: Commit**

```bash
git add src/routes/forge/[spaceId]/+page.svelte
git commit -m "feat: update forge UI text for 3D generation flow"
```

---

### Task 5: Include glbUrl in World page data

**Files:**

- Modify: `src/routes/world/+page.server.ts:21-27`

**Step 1: Add glbUrl to model mapping**

In the `.map()` call (line 21-27), add `glbUrl`:

```typescript
.map((s) => ({
	id: s.id,
	name: s.name,
	imageUrl: s.currentImageUrl,
	glbUrl: s.glbUrl ?? undefined,
	editCount: s.editCount,
	sortOrder: s.sortOrder
}))
```

**Step 2: Verify types**

Run: `bun run check 2>&1 | grep -E "error|ERROR" | head -20`
Expected: 0 errors (the `IslandModel` interface already has `glbUrl?: string`)

**Step 3: Commit**

```bash
git add src/routes/world/+page.server.ts
git commit -m "feat: include glbUrl in world page model data"
```

---

### Task 6: Pass glbUrl through Scene to RoomModel

**Files:**

- Modify: `src/lib/components/scene/Scene.svelte:261-272`

**Step 1: Add glbUrl prop to RoomModel usage**

In the `{#each}` block (line 261-272), add `glbUrl={model.glbUrl}`:

```svelte
{#each models as model, i (model.id)}
	{@const pos = gridPosition(i)}
	<RoomModel
		imageUrl={model.imageUrl}
		glbUrl={model.glbUrl}
		name={model.name}
		position={pos}
		index={i}
		onclick={() => {
			if (!isTransitioning) tweenTo(pos, model);
		}}
	/>
{/each}
```

**Step 2: Verify types**

Run: `bun run check 2>&1 | grep -E "error|ERROR" | head -20`
Expected: will fail because `RoomModel` doesn't accept `glbUrl` yet — that's Task 7.

**Step 3: Commit (together with Task 7)**

This commit happens after Task 7 is complete.

---

### Task 7: Render GLTF or room-corner fallback in RoomModel

**Files:**

- Modify: `src/lib/components/scene/RoomModel.svelte` (full rewrite)

**Step 1: Rewrite RoomModel with GLTF support**

Replace the full file with:

```svelte
<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { GLTF, useTexture } from '@threlte/extras';
	import { RepeatWrapping, Box3, Vector3 } from 'three';
	import type { Group } from 'three';

	let {
		imageUrl,
		glbUrl,
		name,
		position,
		index = 0,
		onclick
	}: {
		imageUrl: string;
		glbUrl?: string;
		name: string;
		position: [number, number, number];
		index?: number;
		onclick?: () => void;
	} = $props();

	let floatY = $state(0);
	let glbScale = $state(1);
	let glbOffsetY = $state(0);

	const px = $derived(position[0]);
	const pz = $derived(position[2]);

	// Floating animation — each island oscillates at a different phase
	useTask(() => {
		floatY = Math.sin(performance.now() * 0.001 + index) * 0.3;
	});

	// Load workspace image as texture (fallback for when no GLB)
	const texture = useTexture(imageUrl, {
		transform: (tex) => {
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			return tex;
		}
	});

	// Auto-fit GLB model to island bounds when loaded
	function handleGltfLoad(ref: { scene: Group }) {
		const box = new Box3().setFromObject(ref.scene);
		const size = new Vector3();
		box.getSize(size);
		const maxDim = Math.max(size.x, size.y, size.z);
		// Scale to fit within ~4 units (island is ~5 units diameter)
		glbScale = maxDim > 0 ? 4 / maxDim : 1;
		// Center vertically on island
		const center = new Vector3();
		box.getCenter(center);
		glbOffsetY = -center.y * glbScale + 0.76;
	}

	function createLabelCanvas(text: string): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 64;
		const ctx = canvas.getContext('2d')!;

		ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
		ctx.beginPath();
		ctx.roundRect(8, 8, 240, 48, 12);
		ctx.fill();

		ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(8, 8, 240, 48, 12);
		ctx.stroke();

		ctx.font = 'bold 22px system-ui, sans-serif';
		ctx.fillStyle = '#e2e8f0';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, 128, 32);

		return canvas;
	}

	const labelCanvas = $derived(createLabelCanvas(name));

	// Room dimensions (fallback)
	const wallW = 3.6;
	const wallH = 2.8;
	const floorD = 2.8;
	const wallThickness = 0.06;
	const baseY = 0.76;
</script>

<!-- Floating island group -->
<T.Group position.y={floatY}>
	<!-- Hexagonal island base -->
	<T.Mesh position={[px, 0, pz]} receiveShadow castShadow {onclick}>
		<T.CylinderGeometry args={[2.5, 2, 1.5, 6]} />
		<T.MeshStandardMaterial color={0x2d5016} roughness={0.8} metalness={0.1} />
	</T.Mesh>

	{#if glbUrl}
		<!-- GLB 3D model (replaces room corner) -->
		<T.Group position={[px, glbOffsetY, pz]} scale={[glbScale, glbScale, glbScale]}>
			<GLTF
				url={glbUrl}
				onload={handleGltfLoad}
				onerror={() => {
					/* GLB load failed — room corner fallback renders below */
				}}
			/>
		</T.Group>
	{:else}
		<!-- Room corner fallback (no GLB available) -->
		<T.Group position={[px - wallW / 4, baseY, pz + floorD / 4]}>
			<!-- Floor -->
			<T.Mesh rotation.x={-Math.PI / 2} position.y={0} receiveShadow {onclick}>
				<T.PlaneGeometry args={[wallW, floorD]} />
				<T.MeshStandardMaterial color={0x8b7355} roughness={0.85} metalness={0.05} />
			</T.Mesh>

			<!-- Back wall (image texture) -->
			<T.Mesh position={[0, wallH / 2, -floorD / 2]} receiveShadow castShadow {onclick}>
				<T.PlaneGeometry args={[wallW, wallH]} />
				{#if $texture}
					<T.MeshStandardMaterial map={$texture} roughness={0.35} metalness={0.0} />
				{:else}
					<T.MeshStandardMaterial color={0xe8e0d0} roughness={0.6} />
				{/if}
			</T.Mesh>

			<!-- Side wall -->
			<T.Mesh
				position={[-wallW / 2, wallH / 2, 0]}
				rotation.y={Math.PI / 2}
				receiveShadow
				castShadow
				{onclick}
			>
				<T.PlaneGeometry args={[floorD, wallH]} />
				<T.MeshStandardMaterial color={0xd0c8b8} roughness={0.7} metalness={0.0} />
			</T.Mesh>

			<!-- Baseboard trim - back wall -->
			<T.Mesh position={[0, 0.06, -floorD / 2 + wallThickness / 2]}>
				<T.BoxGeometry args={[wallW, 0.12, wallThickness]} />
				<T.MeshStandardMaterial color={0x5c4a3a} roughness={0.6} />
			</T.Mesh>

			<!-- Baseboard trim - side wall -->
			<T.Mesh position={[-wallW / 2 + wallThickness / 2, 0.06, 0]}>
				<T.BoxGeometry args={[wallThickness, 0.12, floorD]} />
				<T.MeshStandardMaterial color={0x5c4a3a} roughness={0.6} />
			</T.Mesh>
		</T.Group>
	{/if}

	<!-- Label sprite -->
	<T.Sprite position={[px, 5.5, pz]} scale={[4, 1, 1]}>
		<T.SpriteMaterial transparent>
			<T.CanvasTexture args={[labelCanvas]} attach="map" />
		</T.SpriteMaterial>
	</T.Sprite>
</T.Group>
```

**Key changes:**

- Added `glbUrl?: string` prop
- Import `GLTF` from `@threlte/extras`, `Box3`/`Vector3` from `three`
- `handleGltfLoad` auto-scales GLB to fit ~4 units and centers on island
- `{#if glbUrl}` renders `<GLTF>`, `{:else}` renders room corner fallback
- Hex base always renders (both GLB and fallback sit on it)
- `onclick` added to hex base mesh for GLB mode (was only on room walls before)

**Step 2: Verify types and lint**

Run: `bun run check 2>&1 | grep -E "error|ERROR" | head -20`
Run: `bun run lint`
Expected: 0 errors, lint clean

**Step 3: Commit Tasks 6 + 7 together**

```bash
git add src/lib/components/scene/Scene.svelte src/lib/components/scene/RoomModel.svelte
git commit -m "feat: render GLB 3D models on islands with room-corner fallback"
```

---

### Task 8: Final verification

**Step 1: Full type check**

Run: `bun run check`
Expected: 0 errors, only `state_referenced_locally` warnings

**Step 2: Lint**

Run: `bun run lint`
Expected: clean

**Step 3: Format**

Run: `bun run format`

**Step 4: Manual test checklist**

- [ ] Forge: click "Complete Space" → spinner shows "Generating 3D model..." for ~15-30s
- [ ] Forge: completion modal appears with "Space Forged" and CTA buttons
- [ ] World: completed space with GLB shows 3D model on hex island (auto-scaled)
- [ ] World: spaces without GLB show textured room corner fallback
- [ ] World: click island → camera tweens to it
- [ ] World: press Escape → camera resets to overview
- [ ] Error path: if fal.ai is unreachable, space still completes, World shows room corner

**Step 5: Final commit (if formatting changed)**

```bash
git add -A
git commit -m "chore: lint and format after Hunyuan 3D integration"
```
