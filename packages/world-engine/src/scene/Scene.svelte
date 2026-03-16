<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { Stars, ContactShadows, interactivity } from '@threlte/extras';
	import { FogExp2 } from 'three';
	import type { Vector3 } from 'three';
	import RoomModel from './RoomModel.svelte';
	import CameraController from './CameraController.svelte';
	import Avatar from './Avatar.svelte';
	import type { IslandModel, SceneControls, ViewMode } from '../types';

	let {
		models = [],
		totalSlots,
		onroomselect,
		controls = $bindable<SceneControls | null>(null)
	}: {
		models: IslandModel[];
		totalSlots?: number;
		onroomselect?: (room: IslandModel | null) => void;
		controls?: SceneControls | null;
	} = $props();

	interactivity();

	const { scene } = useThrelte();
	scene.background = null;
	scene.fog = new FogExp2(0x05030e, 0.015);

	// Grid layout
	const slotCount = $derived(Math.max(totalSlots ?? models.length, models.length));
	const cols = $derived(Math.max(Math.ceil(Math.sqrt(slotCount)), 1));
	const spacing = 9;

	function gridPosition(index: number): [number, number, number] {
		const rows = Math.ceil(slotCount / cols);
		const col = index % cols;
		const row = Math.floor(index / cols);
		const x = (col - (cols - 1) / 2) * spacing;
		const z = (row - (rows - 1) / 2) * spacing;
		return [x, 0, z];
	}

	// Island positions lookup
	const islandPositions = $derived(new Map(models.map((m, i) => [m.id, gridPosition(i)])));

	// Bridge connections between adjacent islands
	const bridges = $derived.by(() => {
		const result: {
			position: [number, number, number];
			rotation: number;
			length: number;
		}[] = [];
		const rows = Math.ceil(slotCount / cols);

		for (let i = 0; i < models.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const posA = gridPosition(i);

			// Horizontal neighbor (right)
			if (col + 1 < cols && i + 1 < models.length) {
				const posB = gridPosition(i + 1);
				const midX = (posA[0] + posB[0]) / 2;
				const midZ = (posA[2] + posB[2]) / 2;
				const dx = posB[0] - posA[0];
				const dz = posB[2] - posA[2];
				const length = Math.sqrt(dx * dx + dz * dz) - 5; // subtract island diameters
				const rotation = Math.atan2(dz, dx);
				result.push({ position: [midX, 0, midZ], rotation, length: Math.max(length, 1) });
			}

			// Vertical neighbor (below)
			if (row + 1 < rows && i + cols < models.length) {
				const posB = gridPosition(i + cols);
				const midX = (posA[0] + posB[0]) / 2;
				const midZ = (posA[2] + posB[2]) / 2;
				const dx = posB[0] - posA[0];
				const dz = posB[2] - posA[2];
				const length = Math.sqrt(dx * dx + dz * dz) - 5;
				const rotation = Math.atan2(dz, dx);
				result.push({ position: [midX, 0, midZ], rotation, length: Math.max(length, 1) });
			}
		}

		return result;
	});

	// Camera state — owned by CameraController, bound here for scene use
	let viewMode = $state<ViewMode>('overview');
	let selectedRoom = $state<IslandModel | null>(null);
	let isTransitioning = $state(false);
	let avatarEnabled = $state(false);
	let glbBounds = $state<Map<string, { center: Vector3; radius: number }>>(new Map());
	let navigate = $state<(pos: [number, number, number], room: IslandModel) => void>(() => {});

	// Which island is currently dived into (freezes its float animation)
	const divedRoomId = $derived(viewMode === 'dived' ? selectedRoom?.id : null);
</script>

<!-- Camera controller — manages ortho/perspective cameras, orbit controls, tweens, keyboard nav -->
<CameraController
	{models}
	{islandPositions}
	{cols}
	{onroomselect}
	bind:selectedRoom
	bind:viewMode
	bind:isTransitioning
	bind:glbBounds
	bind:controls
	bind:avatarEnabled
	bind:navigate
/>

<!-- Starfield background -->
<Stars count={1500} radius={80} depth={60} factor={5}
	saturation={0.3} lightness={0.7} speed={0.3} fade opacity={0.9} />

<!-- Lights -->
<T.HemisphereLight args={[0xc8d0ff, 0x1a0a2e, 0.6]} />

<T.DirectionalLight
	position={[12, 30, 8]}
	color={0xffeedd}
	intensity={1.2}
	castShadow
	shadow.mapSize.width={2048}
	shadow.mapSize.height={2048}
	shadow.camera.near={0.5}
	shadow.camera.far={80}
	shadow.camera.left={-30}
	shadow.camera.right={30}
	shadow.camera.top={30}
	shadow.camera.bottom={-30}
/>

<!-- Purple rim light — outlines islands against starfield -->
<T.DirectionalLight position={[-8, 5, -12]} color={0x6b3fa0} intensity={0.4} />

<!-- Contact shadows beneath floating islands -->
<ContactShadows position.y={-2} opacity={0.4} scale={80}
	blur={2.5} far={6} resolution={256}
	color={0x0a0a2e} frames={2} />

<!-- Floating island models -->
{#each models as model, i (model.id)}
	{@const pos = gridPosition(i)}
	<RoomModel
		imageUrl={model.imageUrl}
		modelUrl={model.modelUrl}
		name={model.name}
		position={pos}
		index={i}
		selected={selectedRoom?.id === model.id}
		pauseFloat={divedRoomId === model.id}
		onglbload={(bounds) => {
			glbBounds.set(model.id, bounds);
			glbBounds = glbBounds;
		}}
		onclick={() => {
			if (!isTransitioning) {
				navigate(pos, model);
			}
		}}
	/>
{/each}

<!-- Placeholder hexagonal slots for empty positions -->
{#each Array.from({ length: slotCount - models.length }, (__, i) => i) as j (j)}
	{@const emptyIndex = models.length + j}
	{@const pos = gridPosition(emptyIndex)}
	<T.Group position.y={Math.sin(performance.now() * 0.0005 + emptyIndex) * 0.1}>
		<!-- Ghost hexagonal base -->
		<T.Mesh position={[pos[0], -0.3, pos[2]]}>
			<T.CylinderGeometry args={[2.5, 2, 0.3, 6]} />
			<T.MeshStandardMaterial
				color={0x1a1f36}
				transparent
				opacity={0.3}
				roughness={0.9}
				wireframe
			/>
		</T.Mesh>
		<!-- Dashed ring to indicate empty slot -->
		<T.Mesh position={[pos[0], 0, pos[2]]} rotation.x={-Math.PI / 2}>
			<T.RingGeometry args={[2.2, 2.5, 6]} />
			<T.MeshBasicMaterial color={0x4a3f6b} transparent opacity={0.2} side={2} />
		</T.Mesh>
	</T.Group>
{/each}

<!-- Bridges between adjacent islands -->
{#each bridges as bridge, i (i)}
	<T.Mesh position={[bridge.position[0], 0, bridge.position[2]]} rotation.y={-bridge.rotation}>
		<T.BoxGeometry args={[bridge.length, 0.1, 0.4]} />
		<T.MeshStandardMaterial color={0x4a3728} transparent opacity={0.6} roughness={0.8} />
	</T.Mesh>
{/each}

<!-- Avatar -->
<Avatar enabled={avatarEnabled} />
