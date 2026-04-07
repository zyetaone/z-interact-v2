<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { Vector3, FogExp2, PerspectiveCamera, OrthographicCamera } from 'three';
	import type { IslandModel, SceneControls, ViewMode } from '../types';

	let {
		models = [],
		islandPositions,
		cols,
		onroomselect,
		selectedRoom = $bindable<IslandModel | null>(null),
		viewMode = $bindable<ViewMode>('overview'),
		isTransitioning = $bindable(false),
		glbBounds = $bindable<Map<string, { center: Vector3; radius: number }>>(new Map()),
		controls = $bindable<SceneControls | null>(null),
		avatarEnabled = $bindable(false),
		navigate = $bindable<(pos: [number, number, number], room: IslandModel) => void>(() => {})
	}: {
		models: IslandModel[];
		islandPositions: Map<string, [number, number, number]>;
		cols: number;
		onroomselect?: (room: IslandModel | null) => void;
		selectedRoom?: IslandModel | null;
		viewMode?: ViewMode;
		isTransitioning?: boolean;
		glbBounds?: Map<string, { center: Vector3; radius: number }>;
		controls?: SceneControls | null;
		avatarEnabled?: boolean;
		navigate?: (pos: [number, number, number], room: IslandModel) => void;
	} = $props();

	const { camera, scene } = useThrelte();

	let perspCamRef = $state<PerspectiveCamera | null>(null);
	let orthoCamRef = $state<OrthographicCamera | null>(null);
	let orbitRef = $state<import('three/addons/controls/OrbitControls.js').OrbitControls | null>(
		null
	);

	// Tween state — shared by all camera animations
	let tween = $state<{
		fromPos: Vector3;
		toPos: Vector3;
		fromTarget: Vector3;
		toTarget: Vector3;
		duration: number;
		elapsed: number;
		/** Vertical arc height added mid-flight (sine curve). 0 = flat linear path. */
		arcHeight?: number;
		onComplete: () => void;
	} | null>(null);

	// Reactive OrbitControls configuration per view mode
	$effect(() => {
		if (!orbitRef) return;
		if (viewMode === 'dived') {
			orbitRef.maxPolarAngle = Math.PI / 2.2;
			orbitRef.minPolarAngle = 0.3;
			orbitRef.enablePan = false;
			orbitRef.autoRotate = true;
			orbitRef.autoRotateSpeed = 1.5;
			orbitRef.minDistance = 2;
			orbitRef.maxDistance = 12;
			orbitRef.minZoom = 0;
			orbitRef.maxZoom = Infinity;
		} else if (viewMode === 'overview') {
			orbitRef.maxPolarAngle = Math.PI / 2.5;
			orbitRef.minPolarAngle = 0;
			orbitRef.enablePan = true;
			orbitRef.autoRotate = false;
			orbitRef.autoRotateSpeed = 0;
			orbitRef.minDistance = 0;
			orbitRef.maxDistance = Infinity;
			orbitRef.minZoom = 0.5;
			orbitRef.maxZoom = 3;
		}
	});

	// Reactive fog density — thin when dived for clearer close-up
	$effect(() => {
		if (scene.fog instanceof FogExp2) {
			scene.fog.density = viewMode === 'dived' ? 0.005 : 0.015;
		}
	});

	// Animation tick — drives all camera tweens
	useTask((delta) => {
		if (!tween || !orbitRef) return;

		tween.elapsed += delta * 1000;
		const t = Math.min(tween.elapsed / tween.duration, 1);
		const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

		camera.current.position.lerpVectors(tween.fromPos, tween.toPos, ease);

		// Arc flight: lift camera along a sine curve mid-journey for a realistic
		// "flying through the air" trajectory instead of a flat linear slide.
		if (tween.arcHeight) {
			camera.current.position.y += tween.arcHeight * Math.sin(Math.PI * t);
		}

		orbitRef.target.lerpVectors(tween.fromTarget, tween.toTarget, ease);
		orbitRef.update();

		if (t >= 1) {
			const cb = tween.onComplete;
			tween = null;
			cb();
		}
	});

	// Standard isometric orbital pan (non-GLB islands)
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
			arcHeight: 3, // lift camera through a gentle arc across the sky
			onComplete: () => {
				isTransitioning = false;
			}
		};
	}

	// Dive-in for GLB islands — two-phase animation
	function diveIntoRoom(pos: [number, number, number], room: IslandModel) {
		if (isTransitioning || !orbitRef || !perspCamRef || !orthoCamRef) return;
		const bounds = glbBounds.get(room.id);
		if (!bounds) return;

		selectedRoom = room;
		isTransitioning = true;
		viewMode = 'diving';
		onroomselect?.(room);

		const orbitDist = bounds.radius * 3 + 2;

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: new Vector3(pos[0] + 6, 6, pos[2] + 6),
			fromTarget: orbitRef.target.clone(),
			toTarget: new Vector3(pos[0], 1.5, pos[2]),
			duration: 600,
			elapsed: 0,
			onComplete: () => {
				perspCamRef!.position.copy(camera.current.position);
				perspCamRef!.quaternion.copy(camera.current.quaternion);
				perspCamRef!.updateProjectionMatrix();
				camera.set(perspCamRef!);
				orbitRef!.object = perspCamRef!;
				orbitRef!.target.set(bounds.center.x, bounds.center.y, bounds.center.z);
				orbitRef!.update();

				tween = {
					fromPos: perspCamRef!.position.clone(),
					toPos: new Vector3(
						bounds.center.x + orbitDist * 0.7,
						bounds.center.y + bounds.radius * 0.8,
						bounds.center.z + orbitDist * 0.7
					),
					fromTarget: orbitRef!.target.clone(),
					toTarget: bounds.center.clone(),
					duration: 800,
					elapsed: 0,
					onComplete: () => {
						viewMode = 'dived';
						isTransitioning = false;
					}
				};
			}
		};
	}

	// Return from dive-in to isometric overview
	function doResetView() {
		if (!orbitRef) return;

		if (viewMode === 'dived' || viewMode === 'diving') {
			if (!perspCamRef || !orthoCamRef) return;
			isTransitioning = true;
			viewMode = 'returning';
			onroomselect?.(null);

			tween = {
				fromPos: camera.current.position.clone(),
				toPos: new Vector3(
					camera.current.position.x,
					camera.current.position.y + 10,
					camera.current.position.z
				),
				fromTarget: orbitRef.target.clone(),
				toTarget: orbitRef.target.clone(),
				duration: 500,
				elapsed: 0,
				onComplete: () => {
					orthoCamRef!.position.copy(camera.current.position);
					orthoCamRef!.updateProjectionMatrix();
					camera.set(orthoCamRef!);
					orbitRef!.object = orthoCamRef!;
					orbitRef!.update();

					selectedRoom = null;
					viewMode = 'overview';

					tween = {
						fromPos: orthoCamRef!.position.clone(),
						toPos: new Vector3(30, 30, 30),
						fromTarget: orbitRef!.target.clone(),
						toTarget: new Vector3(0, 0, 0),
						duration: 700,
						elapsed: 0,
						arcHeight: 2, // gentle lift as we pull back to overview
						onComplete: () => {
							isTransitioning = false;
						}
					};
				}
			};
		} else {
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
				arcHeight: 2, // sweep upward through the air back to overview
				onComplete: () => {
					isTransitioning = false;
				}
			};
		}
	}

	// Return from perspective to ortho, then tween to a non-GLB island
	function returnToOrthoThenTween(pos: [number, number, number], room: IslandModel) {
		if (!orbitRef || !perspCamRef || !orthoCamRef) return;
		isTransitioning = true;
		viewMode = 'returning';

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: new Vector3(
				camera.current.position.x,
				camera.current.position.y + 8,
				camera.current.position.z
			),
			fromTarget: orbitRef.target.clone(),
			toTarget: orbitRef.target.clone(),
			duration: 400,
			elapsed: 0,
			onComplete: () => {
				orthoCamRef!.position.copy(camera.current.position);
				orthoCamRef!.updateProjectionMatrix();
				camera.set(orthoCamRef!);
				orbitRef!.object = orthoCamRef!;
				orbitRef!.update();

				viewMode = 'overview';

				selectedRoom = room;
				onroomselect?.(room);

				tween = {
					fromPos: orthoCamRef!.position.clone(),
					toPos: new Vector3(pos[0] + 10, 10, pos[2] + 10),
					fromTarget: orbitRef!.target.clone(),
					toTarget: new Vector3(pos[0], 1.5, pos[2]),
					duration: 700,
					elapsed: 0,
					arcHeight: 3, // arc through the air to the next island
					onComplete: () => {
						isTransitioning = false;
					}
				};
			}
		};
	}

	// Navigate to an island — picks dive or pan based on GLB availability
	function navigateToRoom(pos: [number, number, number], room: IslandModel) {
		const isGlbIsland = room.modelUrl && glbBounds.has(room.id);
		const wasInDive = viewMode === 'dived' || viewMode === 'diving';

		if (isGlbIsland) {
			if (wasInDive) {
				returnToOrthoThenDive(pos, room);
			} else {
				diveIntoRoom(pos, room);
			}
		} else {
			if (wasInDive) {
				returnToOrthoThenTween(pos, room);
			} else {
				tweenTo(pos, room);
			}
		}
	}

	// Return from one GLB dive to another GLB dive
	function returnToOrthoThenDive(pos: [number, number, number], room: IslandModel) {
		if (!orbitRef || !perspCamRef || !orthoCamRef) return;
		isTransitioning = true;
		viewMode = 'returning';

		tween = {
			fromPos: camera.current.position.clone(),
			toPos: new Vector3(
				camera.current.position.x,
				camera.current.position.y + 8,
				camera.current.position.z
			),
			fromTarget: orbitRef.target.clone(),
			toTarget: orbitRef.target.clone(),
			duration: 400,
			elapsed: 0,
			onComplete: () => {
				orthoCamRef!.position.copy(camera.current.position);
				orthoCamRef!.updateProjectionMatrix();
				camera.set(orthoCamRef!);
				orbitRef!.object = orthoCamRef!;
				orbitRef!.update();

				viewMode = 'overview';
				isTransitioning = false;

				diveIntoRoom(pos, room);
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
			if (pos) navigateToRoom(pos, room);
		}
	}

	// Expose navigate function and controls
	navigate = navigateToRoom;
	controls = {
		resetView: doResetView,
		toggleAvatar() {
			avatarEnabled = !avatarEnabled;
			return avatarEnabled;
		}
	};
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- Isometric camera (overview mode) — OrbitControls nested as child -->
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
		orthoCamRef = ref;
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

<!-- Perspective camera (dive-in mode) -->
<T.PerspectiveCamera
	fov={50}
	near={0.1}
	far={200}
	oncreate={(ref) => {
		perspCamRef = ref;
	}}
/>
