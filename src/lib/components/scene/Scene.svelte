<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { OrbitControls, interactivity } from '@threlte/extras';
	import { Vector3, Color, FogExp2 } from 'three';
	import RoomModel from './RoomModel.svelte';
	import Avatar from './Avatar.svelte';
	import type { IslandModel, SceneControls } from '../IsometricScene.svelte';

	let {
		models = [],
		onroomselect,
		controls = $bindable<SceneControls | null>(null)
	}: {
		models: IslandModel[];
		onroomselect?: (room: IslandModel | null) => void;
		controls?: SceneControls | null;
	} = $props();

	interactivity();

	const { camera, scene } = useThrelte();
	scene.background = new Color(0x0a0e1a);
	scene.fog = new FogExp2(0x0a0e1a, 0.015);

	// Grid layout
	const cols = $derived(Math.max(Math.ceil(Math.sqrt(models.length)), 1));
	const spacing = 9;

	function gridPosition(index: number): [number, number, number] {
		const rows = Math.ceil(models.length / cols);
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
		const rows = Math.ceil(models.length / cols);

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

	// Camera tween state
	let selectedRoom = $state<IslandModel | null>(null);
	let isTransitioning = $state(false);
	let avatarEnabled = $state(false);

	let tween = $state<{
		fromPos: Vector3;
		toPos: Vector3;
		fromTarget: Vector3;
		toTarget: Vector3;
		duration: number;
		elapsed: number;
		onComplete: () => void;
	} | null>(null);

	// OrbitControls ref for target manipulation
	let orbitRef = $state<import('three/addons/controls/OrbitControls.js').OrbitControls | null>(
		null
	);

	useTask((delta) => {
		if (!tween || !orbitRef) return;

		tween.elapsed += delta * 1000; // delta is in seconds, duration in ms
		const t = Math.min(tween.elapsed / tween.duration, 1);
		const ease = 1 - Math.pow(1 - t, 3);

		camera.current.position.lerpVectors(tween.fromPos, tween.toPos, ease);
		orbitRef.target.lerpVectors(tween.fromTarget, tween.toTarget, ease);
		orbitRef.update();

		if (t >= 1) {
			const cb = tween.onComplete;
			tween = null;
			cb();
		}
	});

	function tweenTo(pos: [number, number, number], room: IslandModel) {
		if (isTransitioning || !orbitRef) return;
		selectedRoom = room;
		isTransitioning = true;
		onroomselect?.(room);

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: new Vector3(pos[0] + 10, 10, pos[2] + 10),
			fromTarget: orbitRef.target.clone(),
			toTarget: new Vector3(pos[0], 1.5, pos[2]),
			duration: 900,
			elapsed: 0,
			onComplete: () => {
				isTransitioning = false;
			}
		};
	}

	function doResetView() {
		if (!orbitRef) return;
		selectedRoom = null;
		isTransitioning = true;
		onroomselect?.(null);

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: new Vector3(30, 30, 30),
			fromTarget: orbitRef.target.clone(),
			toTarget: new Vector3(0, 0, 0),
			duration: 700,
			elapsed: 0,
			onComplete: () => {
				isTransitioning = false;
			}
		};
	}

	// Keyboard navigation
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && selectedRoom) {
			doResetView();
			return;
		}

		if (!selectedRoom) return;
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;

		e.preventDefault();
		const idx = models.findIndex((m) => m.id === selectedRoom!.id);
		let next = idx;

		if (e.key === 'ArrowRight') next = (idx + 1) % models.length;
		else if (e.key === 'ArrowLeft') next = (idx - 1 + models.length) % models.length;
		else if (e.key === 'ArrowDown') next = Math.min(idx + cols, models.length - 1);
		else if (e.key === 'ArrowUp') next = Math.max(idx - cols, 0);

		if (next !== idx) {
			const room = models[next];
			const pos = islandPositions.get(room.id);
			if (pos) tweenTo(pos, room);
		}
	}

	// Expose controls
	controls = {
		resetView: doResetView,
		toggleAvatar() {
			avatarEnabled = !avatarEnabled;
			return avatarEnabled;
		}
	};
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- Isometric camera -->
<T.OrthographicCamera
	position={[30, 30, 30]}
	zoom={1}
	near={0.1}
	far={200}
	oncreate={(ref) => {
		const aspect = window.innerWidth / window.innerHeight;
		const frustumSize = 24;
		ref.left = (-frustumSize * aspect) / 2;
		ref.right = (frustumSize * aspect) / 2;
		ref.top = frustumSize / 2;
		ref.bottom = -frustumSize / 2;
		ref.updateProjectionMatrix();
		ref.lookAt(0, 0, 0);
		// Set as the default camera for the scene
		camera.set(ref);
	}}
>
	<OrbitControls
		oncreate={(ref) => {
			orbitRef = ref;
		}}
		enableDamping
		dampingFactor={0.06}
		maxPolarAngle={Math.PI / 2.5}
		minZoom={0.5}
		maxZoom={3}
		enablePan
	/>
</T.OrthographicCamera>

<!-- Lights -->
<T.AmbientLight color={0xc8d0ff} intensity={0.5} />

<T.DirectionalLight
	position={[15, 25, 10]}
	intensity={1.0}
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

<T.DirectionalLight position={[-10, 10, -10]} color={0x8080ff} intensity={0.3} />

<!-- Ground (void below islands) -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={-3} receiveShadow>
	<T.PlaneGeometry args={[120, 120]} />
	<T.MeshStandardMaterial color={0x060a12} roughness={0.95} metalness={0} />
</T.Mesh>

<!-- Grid (subtle, below islands) -->
<T.GridHelper args={[80, 80, 0x1a1f36, 0x111827]} position.y={-2.99} />

<!-- Floating island models -->
{#each models as model, i (model.id)}
	{@const pos = gridPosition(i)}
	<RoomModel
		glbUrl={model.glbUrl}
		name={model.name}
		position={pos}
		index={i}
		onclick={() => {
			if (!isTransitioning) tweenTo(pos, model);
		}}
	/>
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
