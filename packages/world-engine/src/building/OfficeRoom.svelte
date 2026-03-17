<script lang="ts">
	import { T } from '@threlte/core';
	import { useTexture, HTML } from '@threlte/extras';
	import { DoubleSide } from 'three';

	let {
		imageUrl,
		name,
		roomCenter,
		index = 0,
		selected = false,
		onclick
	}: {
		imageUrl: string;
		name: string;
		roomCenter: [number, number, number];
		index?: number;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	// Layout constants (must match OfficeFloor)
	const roomWidth = 5;
	const roomDepth = 4;
	const wallHeight = 3.2;
	const wallThickness = 0.12;

	// Image panel (4:3 aspect)
	const panelW = 3.2;
	const panelH = 2.4;
	const frameThickness = 0.08;

	let hovered = $state(false);

	// Load workspace image as texture
	// svelte-ignore state_referenced_locally
	const texture = useTexture(imageUrl);

	// Colors — reactive to selection + hover
	const wallColor = $derived(selected ? 0xf0e8ff : hovered ? 0xf5f0eb : 0xeae5df);
	const floorColor = 0x8b7355;
</script>

<T.Group position={[roomCenter[0], roomCenter[1], roomCenter[2]]}>
	<!-- Room floor (warm wood) -->
	<T.Mesh
		rotation.x={-Math.PI / 2}
		position.y={0.01}
		receiveShadow
		{onclick}
		onpointerenter={() => (hovered = true)}
		onpointerleave={() => (hovered = false)}
	>
		<T.PlaneGeometry args={[roomWidth - wallThickness, roomDepth]} />
		<T.MeshStandardMaterial color={floorColor} roughness={0.7} metalness={0.1} />
	</T.Mesh>

	<!-- Back wall -->
	<T.Mesh position={[0, wallHeight / 2, -roomDepth / 2]} castShadow receiveShadow>
		<T.BoxGeometry args={[roomWidth, wallHeight, wallThickness]} />
		<T.MeshStandardMaterial color={wallColor} roughness={0.6} />
	</T.Mesh>

	<!-- Left wall -->
	<T.Mesh
		position={[-roomWidth / 2, wallHeight / 2, 0]}
		castShadow
		receiveShadow
		{onclick}
		onpointerenter={() => (hovered = true)}
		onpointerleave={() => (hovered = false)}
	>
		<T.BoxGeometry args={[wallThickness, wallHeight, roomDepth]} />
		<T.MeshStandardMaterial color={wallColor} roughness={0.6} />
	</T.Mesh>

	<!-- Right wall -->
	<T.Mesh position={[roomWidth / 2, wallHeight / 2, 0]} castShadow receiveShadow>
		<T.BoxGeometry args={[wallThickness, wallHeight, roomDepth]} />
		<T.MeshStandardMaterial color={wallColor} roughness={0.6} />
	</T.Mesh>

	<!-- Ceiling -->
	<T.Mesh rotation.x={Math.PI / 2} position.y={wallHeight} receiveShadow>
		<T.PlaneGeometry args={[roomWidth - wallThickness, roomDepth]} />
		<T.MeshStandardMaterial color={0xe8e4df} roughness={0.8} />
	</T.Mesh>

	<!-- Picture frame (dark backing behind image) -->
	<T.Mesh
		position={[0, wallHeight / 2 + 0.1, -roomDepth / 2 + wallThickness / 2 + 0.005]}
		castShadow
	>
		<T.BoxGeometry args={[panelW + 0.2, panelH + 0.2, frameThickness]} />
		<T.MeshStandardMaterial color={0x1a1a2e} roughness={0.4} metalness={0.3} />
	</T.Mesh>

	<!-- Workspace image on back wall -->
	<T.Mesh
		position={[0, wallHeight / 2 + 0.1, -roomDepth / 2 + wallThickness / 2 + 0.05]}
		{onclick}
		onpointerenter={() => (hovered = true)}
		onpointerleave={() => (hovered = false)}
	>
		<T.PlaneGeometry args={[panelW, panelH]} />
		{#if $texture}
			<T.MeshStandardMaterial map={$texture} roughness={0.3} metalness={0} />
		{:else}
			<T.MeshStandardMaterial color={0x334155} roughness={0.6} />
		{/if}
	</T.Mesh>

	<!-- Room light (warm downlight) -->
	<T.PointLight
		position={[0, wallHeight - 0.3, -0.5]}
		color={0xfff5e6}
		intensity={selected ? 3 : 1.5}
		distance={8}
		decay={2}
	/>

	<!-- Selection accent — purple strip on floor at doorway -->
	{#if selected}
		<T.Mesh position={[0, 0.02, roomDepth / 2 - 0.05]} rotation.x={-Math.PI / 2}>
			<T.PlaneGeometry args={[roomWidth - wallThickness * 2, 0.08]} />
			<T.MeshBasicMaterial color={0x8b5cf6} side={DoubleSide} />
		</T.Mesh>
	{/if}

	<!-- Room label (HTML for crisp text) -->
	<HTML
		position={[0, wallHeight + 0.6, roomDepth / 2]}
		center
		sprite
		distanceFactor={10}
		pointerEvents="none"
	>
		<div
			class="whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-lg backdrop-blur-sm {selected
				? 'border-purple-500/50 bg-purple-950/90 text-purple-200'
				: 'border-slate-600/30 bg-slate-950/85 text-slate-200'}"
		>
			{name}
		</div>
	</HTML>
</T.Group>
