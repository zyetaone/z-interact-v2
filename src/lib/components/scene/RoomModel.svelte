<script lang="ts">
	import { T } from '@threlte/core';
	import { GLTF } from '@threlte/extras';
	import { Box3, Vector3, type Mesh } from 'three';

	let {
		glbUrl,
		tableId,
		position,
		onclick
	}: {
		glbUrl: string;
		tableId: number;
		position: [number, number, number];
		onclick?: () => void;
	} = $props();

	let loaded = $state(false);
	let failed = $state(false);

	const px = $derived(position[0]);
	const pz = $derived(position[2]);

	function onGltfLoad(gltf: { scene: import('three').Group }) {
		const glbScene = gltf.scene;

		// Normalize size to fit on platform
		const box = new Box3().setFromObject(glbScene);
		const size = box.getSize(new Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		const scale = 4 / maxDim;
		glbScene.scale.setScalar(scale);

		// Center on platform
		const center = box.getCenter(new Vector3());
		glbScene.position.set(px - center.x * scale, 0.15 - box.min.y * scale, pz - center.z * scale);

		// Enable shadows on all meshes
		glbScene.traverse((child) => {
			const mesh = child as Mesh;
			if (mesh.isMesh) {
				mesh.castShadow = true;
				mesh.receiveShadow = true;
			}
		});

		loaded = true;
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

	const labelCanvas = $derived(createLabelCanvas(`Table ${tableId}`));
</script>

<!-- Base platform -->
<T.Mesh position={[px, 0.075, pz]} receiveShadow>
	<T.BoxGeometry args={[5, 0.15, 5]} />
	<T.MeshStandardMaterial color={0x1e1b4b} roughness={0.6} metalness={0.2} />
</T.Mesh>

<!-- Placeholder wireframe (shown until GLB loads) -->
{#if !loaded}
	<T.Mesh position={[px, 1.4, pz]} {onclick}>
		<T.BoxGeometry args={[3, 2.5, 3]} />
		<T.MeshStandardMaterial color={0x6d28d9} transparent opacity={0.15} wireframe />
	</T.Mesh>
{/if}

<!-- Label sprite -->
<T.Sprite position={[px, 5, pz]} scale={[4, 1, 1]}>
	<T.SpriteMaterial transparent>
		<T.CanvasTexture attach="map" image={labelCanvas} />
	</T.SpriteMaterial>
</T.Sprite>

<!-- GLB model -->
<GLTF
	url={glbUrl}
	oncreate={(ref) => onGltfLoad({ scene: ref })}
	onerror={() => {
		failed = true;
		loaded = true;
	}}
	{onclick}
/>
