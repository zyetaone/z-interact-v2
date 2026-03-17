<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useTexture, GLTF, HTML, FakeGlowMaterial } from '@threlte/extras';
	import { Box3, Vector3, DoubleSide } from 'three';

	let {
		imageUrl,
		modelUrl,
		name,
		position,
		index = 0,
		selected = false,
		onclick,
		onglbload,
		pauseFloat = false
	}: {
		imageUrl: string;
		modelUrl?: string | null;
		name: string;
		position: [number, number, number];
		index?: number;
		selected?: boolean;
		onclick?: () => void;
		onglbload?: (bounds: { center: Vector3; radius: number }) => void;
		pauseFloat?: boolean;
	} = $props();

	let floatY = $state(0);
	let glbError = $state(false);
	let ringOpacity = $state(0.4);
	let hovered = $state(false);

	const px = $derived(position[0]);
	const pz = $derived(position[2]);

	const hasGlb = $derived(!!modelUrl && !glbError);
	let boundsCheckCancelled = false;

	// Floating animation — each island oscillates at a different phase
	// pauseFloat freezes the bob when the camera is diving into this island
	useTask(() => {
		if (!pauseFloat) {
			floatY = Math.sin(performance.now() * 0.001 + index) * 0.3;
		}
		if (selected) {
			ringOpacity = 0.3 + Math.sin(performance.now() * 0.003) * 0.2;
		}
	});

	// Load workspace image as texture (used for fallback flat panel)
	// imageUrl is stable per component instance — intentional one-time capture
	// svelte-ignore state_referenced_locally
	const texture = useTexture(imageUrl);

	// Image panel dimensions (4:3 aspect, sized to fit hex island)
	const panelW = 4;
	const panelH = 3;
	const frameThickness = 0.08;
</script>

<!-- Floating island group -->
<T.Group position.y={floatY}>
	<!-- Hexagonal island base -->
	<T.Mesh
		position={[px, 0, pz]}
		receiveShadow
		castShadow
		{onclick}
		onpointerenter={() => (hovered = true)}
		onpointerleave={() => (hovered = false)}
	>
		<T.CylinderGeometry args={[2.5, 2, 1.5, 6]} />
		<T.MeshStandardMaterial
			color={hovered ? 0x3a6b1e : 0x2d5016}
			emissive={hovered ? 0x1a3a0a : 0x000000}
			emissiveIntensity={hovered ? 0.3 : 0}
			roughness={0.8}
			metalness={0.1}
		/>
	</T.Mesh>

	<!-- Selection highlight ring + glow aura -->
	{#if selected}
		<T.Mesh position={[px, 0.01, pz]} rotation.x={-Math.PI / 2}>
			<T.RingGeometry args={[2.6, 3.0, 6]} />
			<T.MeshBasicMaterial color={0x8b5cf6} transparent opacity={ringOpacity} side={DoubleSide} />
		</T.Mesh>
		<!-- Ethereal glow sphere -->
		<T.Mesh position={[px, 1, pz]} scale={[4, 3, 4]}>
			<T.SphereGeometry args={[1, 16, 16]} />
			<FakeGlowMaterial glowColor={0x8b5cf6} falloff={0.5}
				glowInternalRadius={4} glowSharpness={0.5} />
		</T.Mesh>
	{/if}

	{#if hasGlb && modelUrl}
		<!-- 3D GLB model sitting on the hex island -->
		<T.Group
			position={[px, 0.75, pz]}
			scale={[2.5, 2.5, 2.5]}
			oncreate={(ref) => {
				if (!onglbload) return;
				const check = () => {
					if (boundsCheckCancelled) return;
					if (ref.children.length > 0) {
						const box = new Box3().setFromObject(ref);
						const center = new Vector3();
						const size = new Vector3();
						box.getCenter(center);
						box.getSize(size);
						onglbload({ center, radius: Math.max(size.x, size.y, size.z) / 2 });
					} else {
						requestAnimationFrame(check);
					}
				};
				check();
			}}
		>
			<GLTF
				url={modelUrl}
				castShadow
				receiveShadow
				onerror={() => {
					boundsCheckCancelled = true;
					glbError = true;
				}}
			/>
		</T.Group>
	{:else}
		<!-- Fallback: Image panel — upright, slightly tilted back like a display easel -->
		<T.Group position={[px, 0.76, pz]} rotation.x={-0.15}>
			<!-- Dark frame backing -->
			<T.Mesh position.z={-frameThickness / 2} castShadow>
				<T.BoxGeometry args={[panelW + 0.2, panelH + 0.2, frameThickness]} />
				<T.MeshStandardMaterial color={0x1a1a2e} roughness={0.4} metalness={0.3} />
			</T.Mesh>

			<!-- Workspace image -->
			<T.Mesh position.z={0.01} {onclick}>
				<T.PlaneGeometry args={[panelW, panelH]} />
				{#if $texture}
					<T.MeshStandardMaterial map={$texture} roughness={0.3} metalness={0.0} />
				{:else}
					<T.MeshStandardMaterial color={0x334155} roughness={0.6} />
				{/if}
			</T.Mesh>
		</T.Group>
	{/if}

	<!-- HTML label — crisp at all zoom levels -->
	<HTML position={[px, 4.5, pz]} center sprite distanceFactor={12} pointerEvents="none">
		<div class="whitespace-nowrap rounded-lg border border-purple-500/30
			bg-slate-950/85 px-3 py-1.5 text-sm font-semibold text-slate-200
			shadow-lg shadow-purple-500/10 backdrop-blur-sm">
			{name}
		</div>
	</HTML>
</T.Group>
