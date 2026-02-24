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
