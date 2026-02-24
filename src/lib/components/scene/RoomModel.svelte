<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useTexture } from '@threlte/extras';

	let {
		imageUrl,
		name,
		position,
		index = 0,
		onclick
	}: {
		imageUrl: string;
		name: string;
		position: [number, number, number];
		index?: number;
		onclick?: () => void;
	} = $props();

	let floatY = $state(0);

	const px = $derived(position[0]);
	const pz = $derived(position[2]);

	// Floating animation — each island oscillates at a different phase
	useTask(() => {
		floatY = Math.sin(performance.now() * 0.001 + index) * 0.3;
	});

	// Load workspace image as texture
	const texture = useTexture(imageUrl);

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

	// Image panel dimensions (4:3 aspect, sized to fit hex island)
	const panelW = 4;
	const panelH = 3;
	const frameThickness = 0.08;
</script>

<!-- Floating island group -->
<T.Group position.y={floatY}>
	<!-- Hexagonal island base -->
	<T.Mesh position={[px, 0, pz]} receiveShadow castShadow {onclick}>
		<T.CylinderGeometry args={[2.5, 2, 1.5, 6]} />
		<T.MeshStandardMaterial color={0x2d5016} roughness={0.8} metalness={0.1} />
	</T.Mesh>

	<!-- Image panel — upright, slightly tilted back like a display easel -->
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

	<!-- Label sprite -->
	<T.Sprite position={[px, 5, pz]} scale={[4, 1, 1]}>
		<T.SpriteMaterial transparent>
			<T.CanvasTexture args={[labelCanvas]} attach="map" />
		</T.SpriteMaterial>
	</T.Sprite>
</T.Group>
