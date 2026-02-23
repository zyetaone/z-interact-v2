# Workspace Quest Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform workspace-studio-v2 from a table-based workshop tool into a gamified workspace design app with three phases: Quest (progressive reveal binary choices), Forge (AI-edit spaces), and World (floating islands metaverse).

**Architecture:** Client-side quest state machine drives Phase 1. The existing AI edit pipeline (fal.ai + R2 + version tree) powers Phase 2 with minimal changes. Phase 3 extends the existing Threlte scene components into floating islands. Data model replaces `tableId` with session-based `workspaceId`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Threlte 8 (@threlte/core + @threlte/extras), Drizzle ORM + D1/libSQL, fal.ai (Flux Inpainting, SAM2, Trellis-2), Cloudflare Workers + R2, Tailwind CSS 4, Valibot.

---

## Task 0: Delete Redundant Code

Remove table-based routes and features that are being replaced.

**Files to delete:**

- `src/routes/table/` (entire directory — `[tableId]/+page.svelte`, `[tableId]/+page.server.ts`, `[tableId]/workspace.svelte.ts`, `[tableId]/viewer.svelte.ts`, `ai.remote.ts`)
- `src/routes/gallery/` (entire directory)
- `src/routes/workshop/` (entire directory)
- `src/routes/api/poll/` (entire directory)
- `src/lib/components/QRCode.svelte`
- `src/lib/config/tables.ts`

**Files to modify:**

- `src/routes/+page.svelte` — will be completely rewritten as landing page (Task 2)
- `src/routes/+page.server.ts` — will be rewritten (Task 2)

**Step 1: Delete the directories and files**

```bash
rm -rf src/routes/table src/routes/gallery src/routes/workshop src/routes/api/poll
rm src/lib/components/QRCode.svelte src/lib/config/tables.ts
```

**Step 2: Verify no broken imports**

Run: `bun run check`
Expected: Errors will appear for files that import from deleted paths. These will be fixed as we build new routes.

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: remove table-based routes, gallery, workshop, polling, QR"
```

---

## Task 1: New Data Model

Replace `tableId` with session-based workspace model. Add quest progress and spaces tables.

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/server/db/queries.ts`
- Modify: `src/lib/server/db/index.ts` (no changes needed, just verify)
- Create: `src/lib/config/quest.ts` (quest definition)

**Step 1: Rewrite schema.ts**

Replace the existing schema with:

```typescript
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// A user session (replaces the old workspace + tableId concept)
export const sessions = sqliteTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull().default('Adventurer'),
	questCompleted: integer('quest_completed', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

// Each binary choice the user made during the quest
export const questChoices = sqliteTable(
	'quest_choices',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		sessionId: text('session_id').notNull(),
		step: integer('step').notNull(),
		optionA: text('option_a').notNull(), // image filename
		optionB: text('option_b').notNull(), // image filename
		selected: text('selected').notNull(), // 'a' or 'b'
		tags: text('tags').notNull().default('[]'), // JSON array of style tags
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [index('quest_choices_session_idx').on(table.sessionId)]
);

// Each space in the user's workspace (result of quest + forge)
export const spaces = sqliteTable(
	'spaces',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		sessionId: text('session_id').notNull(),
		name: text('name').notNull(), // e.g. "Focus Room"
		originalImageUrl: text('original_image_url').notNull(),
		currentImageUrl: text('current_image_url').notNull(),
		glbUrl: text('glb_url'),
		status: text('status', { enum: ['quest', 'forging', 'complete'] })
			.notNull()
			.default('quest'),
		editCount: integer('edit_count').notNull().default(0),
		activeNodeId: text('active_node_id'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text('updated_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [index('spaces_session_idx').on(table.sessionId)]
);

// Version tree for forge edits (replaces editHistory)
export const editHistory = sqliteTable(
	'edit_history',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		spaceId: text('space_id').notNull(),
		step: integer('step').notNull(),
		parentId: text('parent_id'),
		imageUrl: text('image_url').notNull(),
		prompt: text('prompt').notNull(),
		createdAt: text('created_at')
			.notNull()
			.$defaultFn(() => new Date().toISOString())
	},
	(table) => [
		index('edit_history_space_id_idx').on(table.spaceId),
		index('edit_history_parent_id_idx').on(table.parentId)
	]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type QuestChoice = typeof questChoices.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type EditHistoryEntry = typeof editHistory.$inferSelect;
```

**Step 2: Rewrite queries.ts**

```typescript
import { eq, and, lt, asc, isNotNull, sql } from 'drizzle-orm';
import { getDb } from './index';
import { getRequestEvent } from '$app/server';
import { sessions, questChoices, spaces, editHistory } from './schema';
import type { NewSession, NewSpace } from './schema';

const MAX_EDITS_PER_SPACE = 20;

function db() {
	return getDb(getRequestEvent()?.platform);
}

// --- Sessions ---
export function createSession(data?: Partial<NewSession>) {
	return db()
		.insert(sessions)
		.values(data ?? {})
		.returning()
		.get();
}

export function getSession(id: string) {
	return db().query.sessions.findFirst({ where: eq(sessions.id, id) });
}

export function updateSession(
	id: string,
	data: Partial<Pick<NewSession, 'name' | 'questCompleted'>>
) {
	return db()
		.update(sessions)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(sessions.id, id))
		.returning()
		.get();
}

// --- Quest Choices ---
export function saveQuestChoice(
	sessionId: string,
	step: number,
	optionA: string,
	optionB: string,
	selected: 'a' | 'b',
	tags: string[]
) {
	return db()
		.insert(questChoices)
		.values({
			sessionId,
			step,
			optionA,
			optionB,
			selected,
			tags: JSON.stringify(tags)
		})
		.returning()
		.get();
}

export function getQuestChoices(sessionId: string) {
	return db()
		.select()
		.from(questChoices)
		.where(eq(questChoices.sessionId, sessionId))
		.orderBy(asc(questChoices.step))
		.all();
}

// --- Spaces ---
export function createSpace(data: NewSpace) {
	return db().insert(spaces).values(data).returning().get();
}

export function getSpace(id: string) {
	return db().query.spaces.findFirst({ where: eq(spaces.id, id) });
}

export function getSessionSpaces(sessionId: string) {
	return db()
		.select()
		.from(spaces)
		.where(eq(spaces.sessionId, sessionId))
		.orderBy(asc(spaces.sortOrder))
		.all();
}

export function updateSpace(
	id: string,
	data: Partial<
		Pick<NewSpace, 'currentImageUrl' | 'editCount' | 'status' | 'activeNodeId' | 'glbUrl' | 'name'>
	>
) {
	return db()
		.update(spaces)
		.set({ ...data, updatedAt: new Date().toISOString() })
		.where(eq(spaces.id, id))
		.returning()
		.get();
}

export function getCompletedSpaces(sessionId: string) {
	return db()
		.select()
		.from(spaces)
		.where(and(eq(spaces.sessionId, sessionId), eq(spaces.status, 'complete')))
		.orderBy(asc(spaces.sortOrder))
		.all();
}

export function getAllCompletedSpaces() {
	return db()
		.select()
		.from(spaces)
		.where(and(eq(spaces.status, 'complete'), isNotNull(spaces.glbUrl)))
		.all();
}

// --- Edit History (Forge) ---
export async function addEditNode(
	spaceId: string,
	parentNodeId: string | null,
	newImageUrl: string,
	prompt: string
) {
	const d = db();
	const nodeId = crypto.randomUUID();
	const now = new Date().toISOString();

	const space = await d
		.update(spaces)
		.set({
			currentImageUrl: newImageUrl,
			editCount: sql`${spaces.editCount} + 1`,
			status: 'forging',
			activeNodeId: nodeId,
			updatedAt: now
		})
		.where(and(eq(spaces.id, spaceId), lt(spaces.editCount, MAX_EDITS_PER_SPACE)))
		.returning()
		.get();

	if (!space) {
		const existing = await d.query.spaces.findFirst({ where: eq(spaces.id, spaceId) });
		if (!existing) throw new Error(`Space not found: ${spaceId}`);
		throw new Error(`Edit limit reached (${MAX_EDITS_PER_SPACE} max)`);
	}

	const node = await d
		.insert(editHistory)
		.values({
			id: nodeId,
			spaceId,
			step: space.editCount,
			parentId: parentNodeId,
			imageUrl: newImageUrl,
			prompt
		})
		.returning()
		.get();

	return { space, node };
}

export function getEditHistory(spaceId: string) {
	return db()
		.select()
		.from(editHistory)
		.where(eq(editHistory.spaceId, spaceId))
		.orderBy(asc(editHistory.step))
		.all();
}

export async function deleteEditNode(spaceId: string, nodeId: string) {
	const d = db();
	const [children, node, sp] = await Promise.all([
		d.select().from(editHistory).where(eq(editHistory.parentId, nodeId)).all(),
		d.select().from(editHistory).where(eq(editHistory.id, nodeId)).get(),
		d.select().from(spaces).where(eq(spaces.id, spaceId)).get()
	]);

	if (children.length > 0) throw new Error('Cannot delete a node with children');
	if (!node) throw new Error('Edit node not found');
	if (!sp) throw new Error('Space not found');

	const newActiveNodeId = sp.activeNodeId === nodeId ? (node.parentId ?? null) : sp.activeNodeId;
	let newImageUrl = sp.originalImageUrl;
	if (newActiveNodeId) {
		const activeNode = await d
			.select()
			.from(editHistory)
			.where(eq(editHistory.id, newActiveNodeId))
			.get();
		if (activeNode) newImageUrl = activeNode.imageUrl;
	}

	await d.delete(editHistory).where(eq(editHistory.id, nodeId)).run();
	return d
		.update(spaces)
		.set({
			activeNodeId: newActiveNodeId,
			currentImageUrl: newImageUrl,
			editCount: sql`MAX(${spaces.editCount} - 1, 0)`,
			updatedAt: new Date().toISOString()
		})
		.where(eq(spaces.id, spaceId))
		.returning()
		.get();
}
```

**Step 3: Push schema to local DB**

Run: `bun run db:push`
Expected: Tables created successfully

**Step 4: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/queries.ts
git commit -m "feat: new data model — sessions, quest choices, spaces (replaces tableId)"
```

---

## Task 2: Quest Definition & Engine

Define the quest tree and build the client-side state machine.

**Files:**

- Create: `src/lib/config/quest.ts`
- Create: `src/lib/quest-engine.svelte.ts`

**Step 1: Create quest definition**

File: `src/lib/config/quest.ts`

This defines the binary choice tree. Each step shows two workspace images. The user picks one. After 7 steps, 4-5 spaces are selected.

```typescript
export interface QuestStep {
	id: number;
	category: string; // e.g. "Meeting", "Focus", "Social"
	prompt: string; // question shown to user
	optionA: { image: string; name: string; tags: string[] };
	optionB: { image: string; name: string; tags: string[] };
}

export const QUEST_STEPS: QuestStep[] = [
	{
		id: 1,
		category: 'Workstation',
		prompt: 'Which workspace vibe speaks to you?',
		optionA: {
			image: '/assets/WS 01.jpg',
			name: 'Open Workspace',
			tags: ['open', 'collaborative']
		},
		optionB: {
			image: '/assets/WS 02.jpg',
			name: 'Structured Workspace',
			tags: ['structured', 'focused']
		}
	},
	{
		id: 2,
		category: 'Meeting',
		prompt: 'How does your team meet?',
		optionA: { image: '/assets/4 PAX.jpg', name: 'Small Huddle', tags: ['intimate', 'agile'] },
		optionB: {
			image: '/assets/PROJECT ROOM 01.jpg',
			name: 'Project Room',
			tags: ['formal', 'presentation']
		}
	},
	{
		id: 3,
		category: 'Focus',
		prompt: 'Where do you do your best thinking?',
		optionA: { image: '/assets/FOCUS RM 01.jpg', name: 'Focus Room', tags: ['quiet', 'private'] },
		optionB: { image: '/assets/BOOTH.jpg', name: 'Phone Booth', tags: ['compact', 'quick'] }
	},
	{
		id: 4,
		category: 'Social',
		prompt: 'Where does the team recharge?',
		optionA: { image: '/assets/LOUNGE 01.jpg', name: 'Lounge', tags: ['relaxed', 'social'] },
		optionB: { image: '/assets/PANTRY.jpg', name: 'Pantry', tags: ['casual', 'nourish'] }
	},
	{
		id: 5,
		category: 'Collaboration',
		prompt: 'Pick your creative space:',
		optionA: {
			image: '/assets/PROJECT ROOM 02.jpg',
			name: 'Workshop Room',
			tags: ['creative', 'workshop']
		},
		optionB: {
			image: '/assets/TRAINING RM.jpg',
			name: 'Training Room',
			tags: ['learning', 'presentation']
		}
	},
	{
		id: 6,
		category: 'Privacy',
		prompt: 'Open or enclosed?',
		optionA: { image: '/assets/OP LOUNGE 01.jpg', name: 'Open Lounge', tags: ['open', 'airy'] },
		optionB: {
			image: '/assets/FOCUS RM 02.jpg',
			name: 'Enclosed Focus',
			tags: ['enclosed', 'private']
		}
	},
	{
		id: 7,
		category: 'Kitchen',
		prompt: 'Last one — your ideal pantry:',
		optionA: {
			image: '/assets/OP MK PANTRY.jpg',
			name: 'Open Pantry',
			tags: ['open', 'community']
		},
		optionB: {
			image: '/assets/HYDRATION.jpg',
			name: 'Hydration Station',
			tags: ['minimal', 'efficient']
		}
	}
];

export const TOTAL_QUEST_STEPS = QUEST_STEPS.length;
```

**Step 2: Create quest engine (Svelte 5 rune class)**

File: `src/lib/quest-engine.svelte.ts`

```typescript
import { QUEST_STEPS, type QuestStep } from '$lib/config/quest';

export interface QuestResult {
	spaceName: string;
	imageUrl: string;
	tags: string[];
}

export class QuestEngine {
	currentStep = $state(0);
	choices = $state<Array<{ step: QuestStep; selected: 'a' | 'b' }>>([]);
	isComplete = $derived(this.currentStep >= QUEST_STEPS.length);

	readonly step = $derived(
		this.currentStep < QUEST_STEPS.length ? QUEST_STEPS[this.currentStep] : null
	);

	readonly progress = $derived(this.currentStep / QUEST_STEPS.length);

	choose(option: 'a' | 'b') {
		if (this.isComplete || !this.step) return;
		this.choices = [...this.choices, { step: this.step, selected: option }];
		this.currentStep++;
	}

	get results(): QuestResult[] {
		return this.choices.map((c) => {
			const picked = c.selected === 'a' ? c.step.optionA : c.step.optionB;
			return {
				spaceName: picked.name,
				imageUrl: picked.image,
				tags: picked.tags
			};
		});
	}

	reset() {
		this.currentStep = 0;
		this.choices = [];
	}
}
```

**Step 3: Commit**

```bash
git add src/lib/config/quest.ts src/lib/quest-engine.svelte.ts
git commit -m "feat: quest definition (7 binary choices) and client-side engine"
```

---

## Task 3: Quest Route & UI

Build the `/quest` page with card-flip binary choices.

**Files:**

- Create: `src/routes/quest/+page.svelte`
- Create: `src/routes/quest/+page.server.ts`

**Step 1: Create quest page server load**

File: `src/routes/quest/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';
import { createSession } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ cookies }) => {
	// Get or create session
	let sessionId = cookies.get('session_id');
	if (!sessionId) {
		const session = await createSession();
		sessionId = session.id;
		cookies.set('session_id', sessionId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
	}
	return { sessionId };
};
```

**Step 2: Create quest page**

File: `src/routes/quest/+page.svelte`

Build a full-screen binary choice UI. Two large image cards side by side. Click one to advance. Progress bar at top. Svelte transitions for card animations.

The component should:

- Instantiate `QuestEngine` from `$lib/quest-engine.svelte.ts`
- Show current step's prompt at the top
- Display two image cards (optionA, optionB) with names below
- On click, animate the chosen card and advance to next step
- Show progress bar (currentStep / totalSteps)
- On completion, save results to server and navigate to `/forge`

Key UI details:

- Dark theme matching existing (`bg-slate-950 text-white`)
- Cards use `scale` + `opacity` transitions on enter/exit
- Selected card briefly scales up before transitioning
- Category badge above the prompt
- Mobile: stack cards vertically. Desktop: side by side

**Step 3: Create server action for saving quest results**

File: `src/routes/quest/ai.remote.ts`

```typescript
import * as v from 'valibot';
import { command } from '$app/server';
import { saveQuestChoice, createSpace, updateSession, getSession } from '$lib/server/db/queries';

const SaveQuestSchema = v.object({
	sessionId: v.pipe(v.string(), v.nonEmpty()),
	choices: v.array(
		v.object({
			step: v.number(),
			optionA: v.string(),
			optionB: v.string(),
			selected: v.union([v.literal('a'), v.literal('b')]),
			spaceName: v.string(),
			imageUrl: v.string(),
			tags: v.array(v.string())
		})
	)
});

export const saveQuest = command(SaveQuestSchema, async ({ sessionId, choices }) => {
	const session = await getSession(sessionId);
	if (!session) throw new Error('Session not found');

	// Save each choice
	for (const c of choices) {
		await saveQuestChoice(sessionId, c.step, c.optionA, c.optionB, c.selected, c.tags);
	}

	// Create spaces from chosen options
	const spaceIds: string[] = [];
	for (let i = 0; i < choices.length; i++) {
		const c = choices[i];
		const space = await createSpace({
			sessionId,
			name: c.spaceName,
			originalImageUrl: c.imageUrl,
			currentImageUrl: c.imageUrl,
			status: 'quest',
			sortOrder: i
		});
		spaceIds.push(space.id);
	}

	// Mark quest as completed
	await updateSession(sessionId, { questCompleted: true });

	return { spaceIds };
});
```

**Step 4: Verify it builds**

Run: `bun run check`
Expected: No type errors in quest route

**Step 5: Commit**

```bash
git add src/routes/quest/
git commit -m "feat: quest route — progressive reveal binary choices UI"
```

---

## Task 4: Forge Route (AI Edit)

Adapt the existing editor for per-space AI editing. This is largely a rewiring of the existing `editor/+page.svelte` to work with space IDs instead of table IDs.

**Files:**

- Create: `src/routes/forge/[spaceId]/+page.svelte`
- Create: `src/routes/forge/[spaceId]/+page.server.ts`
- Create: `src/routes/forge/ai.remote.ts`
- Modify: `src/lib/types/workspace.ts` — keep as-is (MaskData, Version, etc. still valid)
- Keep: `src/lib/editor.svelte.ts`, `src/lib/actions/mask-canvas.svelte.ts`, `src/lib/utils/mask.ts` (unchanged)

**Step 1: Create forge server load**

File: `src/routes/forge/[spaceId]/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSpace, getEditHistory } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) throw error(401, 'No session');

	const space = await getSpace(params.spaceId);
	if (!space) throw error(404, 'Space not found');
	if (space.sessionId !== sessionId) throw error(403, 'Not your space');

	const history = await getEditHistory(space.id);

	// List asset images for "change image" feature
	const assetImages = []; // Can populate from static assets if needed

	return {
		space,
		history: history.map((h) => ({
			id: h.id,
			step: h.step,
			parentId: h.parentId,
			imageUrl: h.imageUrl,
			prompt: h.prompt,
			createdAt: h.createdAt
		})),
		assetImages
	};
};
```

**Step 2: Create forge remote commands**

File: `src/routes/forge/ai.remote.ts`

This mirrors `src/routes/table/ai.remote.ts` but uses `spaceId` instead of `tableId`. Copy the validation schemas and adapt:

- `editImage` command: same logic, but uses `getSpace(spaceId)` and `addEditNode(spaceId, ...)`
- `segmentObject` command: identical (no table dependency)
- `deleteImage` command: uses `spaceId`
- `completeSpace` command (new): marks space as `complete` and triggers 3D generation

```typescript
import * as v from 'valibot';
import { command } from '$app/server';
import { createImageEditor, createImageSegmenter, resolveImageForFal } from '$lib/server/ai';
import { BLOCKED_TERMS } from '$lib/utils/edit-prompt';
import { persistImage } from '$lib/server/storage';
import { addEditNode, updateSpace, getSpace, deleteEditNode } from '$lib/server/db/queries';
import { generate3dModel } from '$lib/server/ai/fal-3d';

const MAX_EDITS = 20;

const safeImageUrl = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.check((url) => !url.includes('..'), 'Path traversal not allowed'),
	v.check(
		(url) =>
			url.startsWith('/uploads/') ||
			url.startsWith('/assets/') ||
			url.startsWith('/api/r2/') ||
			url.startsWith('https://'),
		'Invalid image URL'
	)
);

const safeMediaUrl = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.check((url) => !url.includes('..'), 'Path traversal not allowed'),
	v.check(
		(url) =>
			url.startsWith('data:image/') ||
			url.startsWith('/uploads/') ||
			url.startsWith('/assets/') ||
			url.startsWith('/api/r2/') ||
			url.startsWith('https://'),
		'Invalid media URL'
	)
);

export const editImage = command(
	v.object({
		imageUrl: safeImageUrl,
		editPrompt: v.pipe(v.string(), v.nonEmpty(), v.maxLength(500)),
		maskUrl: v.optional(safeMediaUrl),
		assetUrl: v.optional(safeImageUrl),
		tool: v.optional(
			v.union([v.literal('draw'), v.literal('brush'), v.literal('magic'), v.literal('poly')])
		),
		mode: v.optional(v.union([v.literal('add'), v.literal('subtract'), v.literal('modify')])),
		spaceId: v.pipe(v.string(), v.nonEmpty()),
		strength: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
		sourceNodeId: v.optional(v.nullable(v.string()))
	}),
	async ({
		imageUrl,
		editPrompt,
		maskUrl,
		assetUrl,
		tool,
		mode,
		spaceId,
		strength,
		sourceNodeId
	}) => {
		const space = await getSpace(spaceId);
		if (!space) throw new Error('Space not found');
		if (space.status === 'complete') throw new Error('Space is already complete');
		if (space.editCount >= MAX_EDITS) throw new Error(`Edit limit reached (${MAX_EDITS} max)`);

		const promptNormalized = editPrompt
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		for (const term of BLOCKED_TERMS) {
			if (promptNormalized.includes(term)) throw new Error('Prompt contains inappropriate content');
		}

		const editor = createImageEditor();
		const result = await editor.edit({
			imageUrl,
			maskUrl,
			assetUrl,
			tool,
			mode,
			prompt: editPrompt,
			strength: strength ?? 0.75
		});

		const permanentUrl = await persistImage(result.imageUrl);
		const { space: updatedSpace, node } = await addEditNode(
			spaceId,
			sourceNodeId ?? null,
			permanentUrl,
			editPrompt
		);

		return {
			imageUrl: permanentUrl,
			editCount: updatedSpace.editCount,
			nodeId: node.id,
			step: node.step
		};
	}
);

export const segmentObject = command(
	v.object({ imageUrl: safeImageUrl, points: v.array(v.tuple([v.number(), v.number()])) }),
	async ({ imageUrl, points }) => {
		const segmenter = createImageSegmenter();
		const result = await segmenter.segment({ imageUrl, points });
		return { maskUrl: result.maskUrl };
	}
);

export const deleteImage = command(
	v.object({ spaceId: v.pipe(v.string(), v.nonEmpty()), nodeId: v.pipe(v.string(), v.nonEmpty()) }),
	async ({ spaceId, nodeId }) => {
		const space = await getSpace(spaceId);
		if (!space) throw new Error('Space not found');
		if (space.status === 'complete') throw new Error('Cannot edit a completed space');
		const updated = await deleteEditNode(spaceId, nodeId);
		return { space: updated };
	}
);

export const completeSpace = command(
	v.object({ spaceId: v.pipe(v.string(), v.nonEmpty()) }),
	async ({ spaceId }) => {
		const space = await getSpace(spaceId);
		if (!space) throw new Error('Space not found');

		// Generate 3D model
		const imageUrl = await resolveImageForFal(space.currentImageUrl);
		const { glbUrl } = await generate3dModel(imageUrl);
		const permanentGlb = await persistImage(glbUrl);

		const updated = await updateSpace(spaceId, { status: 'complete', glbUrl: permanentGlb });
		return { space: updated };
	}
);
```

**Step 3: Create forge page**

File: `src/routes/forge/[spaceId]/+page.svelte`

This is a streamlined version of the existing `editor/+page.svelte` adapted for spaceId. Key differences:

- Uses `spaceId` from `$page.params` instead of `tableId`
- Imports from `../ai.remote` (forge version)
- Adds a "Complete & Generate 3D" button that calls `completeSpace`
- Removes table-specific features (table config, workshop links)
- Navigation: "Back to Quest Results" and "View in World" buttons

The Workspace class (`workspace.svelte.ts`) needs to be adapted or a new `ForgeWorkspace` class created that works with `spaceId`. Create this as:

File: `src/routes/forge/forge-workspace.svelte.ts`

```typescript
import { pushState } from '$app/navigation';
import type { Version, WorkspaceStatus, MaskData } from '$lib/types/workspace';
import { buildTree } from '$lib/utils/version-tree';
import { editImage, deleteImage, completeSpace } from './ai.remote';

const MAX_EDITS = 20;

export class ForgeWorkspace {
	versions = $state<Version[]>([]);
	activeId = $state<string | null>(null);
	status = $state<'forging' | 'complete'>('forging');
	editCount = $state(0);
	originalImageUrl = $state('');
	spaceId = $state('');
	spaceName = $state('');
	isProcessing = $state(false);
	errorMessage = $state('');
	compareId = $state<string | null>(null);
	isComparing = $state(false);
	glbUrl = $state<string | null>(null);

	constructor(data: {
		space: {
			id: string;
			name: string;
			originalImageUrl: string;
			currentImageUrl: string;
			status: string;
			editCount: number;
			activeNodeId?: string | null;
			glbUrl?: string | null;
		};
		history: Version[];
	}) {
		this.spaceId = data.space.id;
		this.spaceName = data.space.name;
		this.originalImageUrl = data.space.originalImageUrl;
		this.editCount = data.space.editCount;
		this.activeId = data.space.activeNodeId ?? null;
		this.versions = data.history;
		this.status = data.space.status === 'complete' ? 'complete' : 'forging';
		this.glbUrl = data.space.glbUrl ?? null;
	}

	readonly tree = $derived(buildTree(this.versions));
	readonly activeVersion = $derived(this.versions.find((v) => v.id === this.activeId));
	readonly currentImageUrl = $derived(this.activeVersion?.imageUrl ?? this.originalImageUrl);
	readonly hasReachedLimit = $derived(this.editCount >= MAX_EDITS);

	async generate(
		prompt: string,
		mask?: MaskData,
		mode?: 'add' | 'subtract' | 'modify',
		strength?: number
	) {
		const hasMask = !!(
			mask?.aiMaskUrl ||
			mask?.rects?.length ||
			mask?.paths?.length ||
			mask?.polygons?.length
		);
		if ((!prompt.trim() && !hasMask) || this.isProcessing || this.hasReachedLimit) return;

		const effectivePrompt =
			prompt.trim() || 'Seamlessly fill this area to match the surrounding workspace';
		this.isProcessing = true;
		this.errorMessage = '';

		try {
			const result = await editImage({
				imageUrl: this.currentImageUrl,
				editPrompt: effectivePrompt,
				maskUrl: mask?.aiMaskUrl ?? undefined,
				assetUrl: mask?.assetUrl ?? undefined,
				tool: mask?.tool,
				mode,
				spaceId: this.spaceId,
				strength: strength ?? 0.75,
				sourceNodeId: this.activeId
			});

			const newVersion: Version = {
				id: result.nodeId,
				step: result.step,
				parentId: this.activeId,
				imageUrl: result.imageUrl,
				prompt: effectivePrompt,
				createdAt: new Date().toISOString()
			};

			this.versions = [...this.versions, newVersion];
			this.activeId = newVersion.id;
			this.editCount = result.editCount;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Edit failed';
		} finally {
			this.isProcessing = false;
		}
	}

	activate(versionId: string | null) {
		this.activeId = versionId;
	}

	async delete(versionId: string) {
		if (this.isProcessing) return;
		if (!confirm('Delete this version?')) return;
		try {
			const { space } = await deleteImage({ spaceId: this.spaceId, nodeId: versionId });
			this.versions = this.versions.filter((v) => v.id !== versionId);
			if (this.activeId === versionId)
				this.activeId =
					this.versions.find(
						(v) => v.id === this.versions.find((v2) => v2.id === versionId)?.parentId
					)?.id ?? null;
			this.editCount = space.editCount;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : 'Delete failed';
		}
	}

	async complete() {
		if (this.isProcessing) return;
		this.isProcessing = true;
		this.errorMessage = '';
		try {
			const { space } = await completeSpace({ spaceId: this.spaceId });
			this.status = 'complete';
			this.glbUrl = space.glbUrl;
		} catch (e) {
			this.errorMessage = e instanceof Error ? e.message : '3D generation failed';
		} finally {
			this.isProcessing = false;
		}
	}

	toggleComparison() {
		this.isComparing = !this.isComparing;
		this.compareId = this.isComparing ? (this.activeVersion?.parentId ?? null) : null;
	}
}
```

**Step 4: Build the forge page UI**

The forge page should reuse the existing editor components (`CommandBar`, `EditorBar`, `VersionTree`, `BottomSheet`) with the `ForgeWorkspace` class. Add a "Complete & Build 3D" button in the header area.

**Step 5: Verify**

Run: `bun run check`

**Step 6: Commit**

```bash
git add src/routes/forge/
git commit -m "feat: forge route — AI-edit spaces with version tree and 3D completion"
```

---

## Task 5: Landing Page & Navigation

Replace the old landing page with the quest entry point.

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/+page.server.ts`
- Modify: `src/routes/+layout.svelte` (if needed for session cookie)
- Remove: `src/routes/editor/` — functionality moved to `/forge`

**Step 1: Rewrite landing page**

The new landing page should:

- Show the app title "Workspace Quest"
- Brief description: "Design your ideal workspace through an interactive quest"
- Large "Start Quest" CTA button → navigates to `/quest`
- If user has a session with completed quest, show "Continue to Forge" or "Enter World" buttons
- Dark theme, minimal, atmospheric

**Step 2: Update page server load**

```typescript
import type { PageServerLoad } from './$types';
import { getSession, getSessionSpaces } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) return { hasSession: false, spaces: [] };

	const session = await getSession(sessionId);
	if (!session) return { hasSession: false, spaces: [] };

	const spaces = await getSessionSpaces(sessionId);
	return {
		hasSession: true,
		questCompleted: session.questCompleted,
		spaces: spaces.map((s) => ({
			id: s.id,
			name: s.name,
			status: s.status,
			imageUrl: s.currentImageUrl
		}))
	};
};
```

**Step 3: Remove old editor route**

```bash
rm -rf src/routes/editor
```

The editor functionality now lives at `/forge/[spaceId]`.

**Step 4: Verify and commit**

Run: `bun run check`

```bash
git add -A
git commit -m "feat: landing page with quest entry, remove standalone editor route"
```

---

## Task 6: World Route — Floating Islands

Adapt the existing Threlte scene for floating islands.

**Files:**

- Modify: `src/lib/components/scene/Scene.svelte`
- Modify: `src/lib/components/scene/RoomModel.svelte` → rename concept to `IslandModel`
- Modify: `src/lib/components/IsometricScene.svelte`
- Modify: `src/routes/world/+page.svelte`
- Modify: `src/routes/world/+page.server.ts`

**Step 1: Update world page server load**

File: `src/routes/world/+page.server.ts`

```typescript
import type { PageServerLoad } from './$types';
import { getSession, getCompletedSpaces } from '$lib/server/db/queries';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionId = cookies.get('session_id');
	if (!sessionId) throw error(401, 'Start a quest first');

	const session = await getSession(sessionId);
	if (!session) throw error(401, 'Session not found');

	const spaces = await getCompletedSpaces(sessionId);

	return {
		models: spaces
			.filter((s) => s.glbUrl)
			.map((s) => ({
				id: s.id,
				name: s.name,
				imageUrl: s.currentImageUrl,
				glbUrl: s.glbUrl!,
				editCount: s.editCount
			})),
		pending: spaces
			.filter((s) => !s.glbUrl)
			.map((s) => ({
				id: s.id,
				name: s.name,
				imageUrl: s.currentImageUrl
			}))
	};
};
```

**Step 2: Update IsometricScene interface**

Modify `src/lib/components/IsometricScene.svelte` to use the new interface:

```typescript
export interface IslandModel {
	id: string;
	name: string;
	imageUrl: string;
	glbUrl: string;
	editCount: number;
}
```

Replace `RoomModel` with `IslandModel` throughout. Update the `Scene.svelte` and `RoomModel.svelte` accordingly — rename labels from "Table X" to the space name.

**Step 3: Make islands float**

In `RoomModel.svelte` (or renamed `IslandModel.svelte`):

- Replace the flat rectangular platform with a hexagonal island base
- Add a `useTask` for gentle floating animation (sine wave on Y position)
- Platform geometry: `CylinderGeometry` with beveled edges, rocky texture color
- Position slightly above y=0 with float offset

**Step 4: Add bridges between islands**

In `Scene.svelte`:

- For each pair of adjacent islands, render a bridge mesh (thin box or tube geometry connecting their positions)
- Bridges appear when islands are close enough in the grid

**Step 5: Update world page UI**

Update `src/routes/world/+page.svelte`:

- Replace "Table X" references with space names
- Update navigation links (Gallery → Forge, etc.)
- Update info panel to show space name instead of tableId

**Step 6: Verify and commit**

```bash
git add -A
git commit -m "feat: world route — floating islands with bridges and space names"
```

---

## Task 7: Metaverse Route

All users' completed islands in one view.

**Files:**

- Create: `src/routes/metaverse/+page.svelte`
- Create: `src/routes/metaverse/+page.server.ts`

**Step 1: Create metaverse server load**

```typescript
import type { PageServerLoad } from './$types';
import { getAllCompletedSpaces } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const allSpaces = await getAllCompletedSpaces();
	return {
		models: allSpaces.map((s) => ({
			id: s.id,
			name: s.name,
			imageUrl: s.currentImageUrl,
			glbUrl: s.glbUrl!,
			editCount: s.editCount
		}))
	};
};
```

**Step 2: Create metaverse page**

Reuse `IsometricScene` component. The metaverse page shows ALL users' islands in a larger grid/ring. Add session owner labels to differentiate.

**Step 3: Commit**

```bash
git add src/routes/metaverse/
git commit -m "feat: metaverse route — all users' floating islands connected"
```

---

## Task 8: API Route Cleanup

Update remaining API routes to work with the new data model.

**Files:**

- Modify: `src/routes/api/workspace/+server.ts` — update to use sessions/spaces
- Modify: `src/routes/api/iso/+server.ts` — update to use spaceId
- Modify: `src/routes/api/upload/+server.ts` — keep as-is (generic image upload)
- Delete: `src/routes/api/poll/` (already done in Task 0)
- Keep: `src/routes/api/r2/` (unchanged, generic proxy)
- Evaluate: `src/routes/api/video/+server.ts` — keep or adapt for future use

**Step 1: Update workspace API**

The `/api/workspace` POST endpoint currently creates workspaces by tableId. Update it to work with sessions and spaces, or remove it if the `command()` pattern in `ai.remote.ts` handles everything.

**Step 2: Update iso API**

The `/api/iso` POST endpoint generates 3D from a tableId. This is now handled by `completeSpace` in `forge/ai.remote.ts`. The API route can be simplified or removed.

**Step 3: Verify no broken imports**

Run: `bun run check`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: update API routes for new session/space data model"
```

---

## Task 9: Final Cleanup & Polish

**Files:**

- Remove: any remaining references to `tableId`, `TABLE_COUNT`, `isValidTableId`
- Update: `src/lib/components/LayerBar.svelte` — update navigation for new routes
- Update: `CLAUDE.md` — document new routes and architecture
- Run: `bun run lint && bun run check`

**Step 1: Search for remaining tableId references**

```bash
grep -r "tableId\|TABLE_COUNT\|isValidTableId\|table_id" src/ --include="*.ts" --include="*.svelte" -l
```

Fix any remaining references.

**Step 2: Update LayerBar**

The existing LayerBar navigates between canvas/world/video layers using tableId. Update it to work with spaceId for forge navigation.

**Step 3: Full lint and type check**

Run: `bun run lint && bun run check`
Fix any remaining issues.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup — remove all tableId references, update navigation"
```

---

## Dependency Graph

```
Task 0 (Delete redundant) ──┐
                              ├── Task 1 (Data model) ──┬── Task 2 (Quest definition)
                              │                          │
                              │                          ├── Task 3 (Quest UI) ── depends on Task 2
                              │                          │
                              │                          ├── Task 4 (Forge) ── depends on Task 1
                              │                          │
                              │                          ├── Task 5 (Landing) ── depends on Task 3
                              │                          │
                              │                          ├── Task 6 (World) ── depends on Task 4
                              │                          │
                              │                          └── Task 7 (Metaverse) ── depends on Task 6
                              │
                              └── Task 8 (API cleanup) ── depends on Tasks 1-7
                                    │
                                    └── Task 9 (Final cleanup) ── depends on Task 8
```

**Parallelizable work:**

- Tasks 2+3 (Quest) and Task 4 (Forge) can proceed in parallel after Task 1
- Task 6 (World) and Task 5 (Landing) can proceed in parallel
- Task 7 (Metaverse) depends only on Task 6

---

## Team Composition (for agentic teams)

| Teammate      | Tasks              | Focus                             |
| ------------- | ------------------ | --------------------------------- |
| **lead**      | Coordinate, review | Task 0, 1, 8, 9                   |
| **quest-dev** | Tasks 2, 3, 5      | Quest engine, UI, landing page    |
| **forge-dev** | Task 4             | Forge editor, AI commands         |
| **world-dev** | Tasks 6, 7         | Threlte scene, islands, metaverse |
