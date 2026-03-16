<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Stars, OrbitControls, ContactShadows, interactivity } from '@threlte/extras';
	import { Vector3, FogExp2 } from 'three';
	import type { PerspectiveCamera as PerspCam } from 'three';
	import OfficeRoom from './OfficeRoom.svelte';
	import type { IslandModel, BuildingControls } from '../types';

	let {
		rooms = [],
		onroomselect,
		controls = $bindable<BuildingControls | null>(null)
	}: {
		rooms: IslandModel[];
		onroomselect?: (room: IslandModel | null) => void;
		controls?: BuildingControls | null;
	} = $props();

	interactivity();

	const { camera, scene } = useThrelte();

	// Layout constants
	const roomWidth = 5;
	const roomDepth = 4;
	const corridorDepth = 3;
	// svelte-ignore state_referenced_locally
	const totalRooms = Math.max(rooms.length, 1);
	const totalWidth = totalRooms * roomWidth;

	// Scene setup
	scene.background = null;
	scene.fog = new FogExp2(0x05030e, 0.008);

	// Room center positions
	function roomPosition(index: number): [number, number, number] {
		const x = (index - (totalRooms - 1) / 2) * roomWidth;
		return [x, 0, -roomDepth / 2];
	}

	// Camera positions
	const overviewPos = new Vector3(0, 6, 14);
	const overviewTarget = new Vector3(0, 1.5, -1);

	function roomCameraPos(index: number): Vector3 {
		const pos = roomPosition(index);
		return new Vector3(pos[0], 2.2, 3.5);
	}

	function roomCameraTarget(index: number): Vector3 {
		const pos = roomPosition(index);
		return new Vector3(pos[0], 1.8, -roomDepth / 2);
	}

	// State
	let selectedRoom = $state<IslandModel | null>(null);
	let selectedIndex = $state(-1);
	let isTransitioning = $state(false);
	let camRef = $state<PerspCam | null>(null);
	let orbitRef = $state<import('three/addons/controls/OrbitControls.js').OrbitControls | null>(
		null
	);

	// Tween state
	let tween = $state<{
		fromPos: Vector3;
		toPos: Vector3;
		fromTarget: Vector3;
		toTarget: Vector3;
		duration: number;
		elapsed: number;
		onComplete: () => void;
	} | null>(null);

	// Animation tick
	useTask((delta) => {
		if (!tween || !orbitRef) return;

		tween.elapsed += delta * 1000;
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

	// Navigation
	function navigateToRoom(index: number) {
		if (isTransitioning || !orbitRef || index < 0 || index >= rooms.length) return;

		const room = rooms[index];
		selectedRoom = room;
		selectedIndex = index;
		isTransitioning = true;
		onroomselect?.(room);

		orbitRef.enablePan = false;
		orbitRef.maxPolarAngle = Math.PI / 2;

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: roomCameraPos(index),
			fromTarget: orbitRef.target.clone(),
			toTarget: roomCameraTarget(index),
			duration: 800,
			elapsed: 0,
			onComplete: () => {
				isTransitioning = false;
			}
		};
	}

	function resetView() {
		if (isTransitioning || !orbitRef) return;

		selectedRoom = null;
		selectedIndex = -1;
		isTransitioning = true;
		onroomselect?.(null);

		orbitRef.enablePan = true;
		orbitRef.maxPolarAngle = Math.PI / 2.2;

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: overviewPos,
			fromTarget: orbitRef.target.clone(),
			toTarget: overviewTarget,
			duration: 800,
			elapsed: 0,
			onComplete: () => {
				isTransitioning = false;
			}
		};
	}

	function focusRoom(roomId: string) {
		const index = rooms.findIndex((r) => r.id === roomId);
		if (index >= 0) navigateToRoom(index);
	}

	// Keyboard
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape' && selectedRoom) {
			resetView();
			return;
		}

		if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
		e.preventDefault();

		if (selectedIndex < 0) {
			navigateToRoom(0);
			return;
		}

		if (e.key === 'ArrowRight') {
			navigateToRoom(Math.min(selectedIndex + 1, rooms.length - 1));
		} else if (e.key === 'ArrowLeft') {
			navigateToRoom(Math.max(selectedIndex - 1, 0));
		}
	}

	// Expose controls
	controls = { resetView, focusRoom };
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- Stars background -->
<Stars
	count={1500}
	radius={80}
	depth={60}
	factor={5}
	saturation={0.3}
	lightness={0.7}
	speed={0.3}
	fade
	opacity={0.9}
/>

<!-- Lighting -->
<T.HemisphereLight args={[0xffeedd, 0x1a0a2e, 0.5]} />

<T.DirectionalLight
	position={[10, 20, 10]}
	color={0xffeedd}
	intensity={0.8}
	castShadow
	shadow.mapSize.width={2048}
	shadow.mapSize.height={2048}
	shadow.camera.near={0.5}
	shadow.camera.far={60}
	shadow.camera.left={-20}
	shadow.camera.right={20}
	shadow.camera.top={10}
	shadow.camera.bottom={-10}
/>

<!-- Purple rim light -->
<T.DirectionalLight position={[-8, 5, -12]} color={0x6b3fa0} intensity={0.3} />

<!-- Corridor floor (dark polished) -->
<T.Mesh rotation.x={-Math.PI / 2} position={[0, 0, corridorDepth / 2]} receiveShadow>
	<T.PlaneGeometry args={[totalWidth + 4, corridorDepth + 2]} />
	<T.MeshStandardMaterial color={0x2a2a3a} roughness={0.4} metalness={0.3} />
</T.Mesh>

<!-- Glass railing at corridor edge -->
<T.Mesh position={[0, 0.5, corridorDepth + 0.5]}>
	<T.BoxGeometry args={[totalWidth + 4, 1, 0.05]} />
	<T.MeshPhysicalMaterial
		color={0x88aacc}
		transparent
		opacity={0.15}
		roughness={0.05}
		metalness={0.1}
		transmission={0.8}
	/>
</T.Mesh>

<!-- Railing posts -->
{#each Array.from({ length: totalRooms + 1 }, (_, i) => i) as pi (pi)}
	{@const postX = (pi - totalRooms / 2) * roomWidth}
	<T.Mesh position={[postX, 0.5, corridorDepth + 0.5]}>
		<T.CylinderGeometry args={[0.03, 0.03, 1, 8]} />
		<T.MeshStandardMaterial color={0x888888} metalness={0.8} roughness={0.2} />
	</T.Mesh>
{/each}

<!-- Contact shadows -->
<ContactShadows
	position.y={0.01}
	opacity={0.3}
	scale={totalWidth + 10}
	blur={2}
	far={4}
	resolution={256}
	color={0x0a0a2e}
	frames={2}
/>

<!-- Rooms -->
{#each rooms as room, i (room.id)}
	<OfficeRoom
		imageUrl={room.imageUrl}
		name={room.name}
		roomCenter={roomPosition(i)}
		index={i}
		selected={selectedRoom?.id === room.id}
		onclick={() => {
			if (!isTransitioning) navigateToRoom(i);
		}}
	/>
{/each}

<!-- Camera -->
<T.PerspectiveCamera
	fov={50}
	near={0.1}
	far={200}
	position={[overviewPos.x, overviewPos.y, overviewPos.z]}
	oncreate={(ref) => {
		camRef = ref;
		ref.lookAt(overviewTarget);
		camera.set(ref);
	}}
>
	<OrbitControls
		oncreate={(ref) => {
			orbitRef = ref;
			ref.target.copy(overviewTarget);
			ref.update();
		}}
		enableDamping
		dampingFactor={0.06}
		maxPolarAngle={Math.PI / 2.2}
		minPolarAngle={0.1}
		enablePan
		minDistance={2}
		maxDistance={25}
	/>
</T.PerspectiveCamera>
