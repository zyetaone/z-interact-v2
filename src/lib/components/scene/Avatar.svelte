<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { SvelteSet } from 'svelte/reactivity';
	import { Vector3, DoubleSide } from 'three';

	let {
		enabled = false,
		moveSpeed = 0.15
	}: {
		enabled?: boolean;
		moveSpeed?: number;
	} = $props();

	const { camera } = useThrelte();
	const keys = new SvelteSet<string>();
	let posX = $state(0);
	let posZ = $state(0);
	let ringOpacity = $state(0.3);

	function onKeyDown(e: KeyboardEvent) {
		if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
			keys.add(e.key.toLowerCase());
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		keys.delete(e.key.toLowerCase());
	}

	useTask(() => {
		if (!enabled || keys.size === 0) return;

		const dir = new Vector3();
		if (keys.has('w')) dir.z -= 1;
		if (keys.has('s')) dir.z += 1;
		if (keys.has('a')) dir.x -= 1;
		if (keys.has('d')) dir.x += 1;

		if (dir.length() > 0) {
			dir.normalize().multiplyScalar(moveSpeed);

			const cam = camera.current;
			const camAngle = Math.atan2(cam.position.x, cam.position.z);
			dir.applyAxisAngle(new Vector3(0, 1, 0), camAngle);

			posX += dir.x;
			posZ += dir.z;
		}

		ringOpacity = 0.2 + Math.sin(performance.now() * 0.005) * 0.15;
	});
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

{#if enabled}
	<T.Mesh position={[posX, 0.2, posZ]}>
		<T.CylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
		<T.MeshStandardMaterial color={0x8b5cf6} emissive={0x8b5cf6} emissiveIntensity={0.5} />

		<!-- Pulsing ring -->
		<T.Mesh rotation.x={-Math.PI / 2} position.y={-0.05}>
			<T.RingGeometry args={[0.4, 0.6, 32]} />
			<T.MeshBasicMaterial color={0x8b5cf6} transparent opacity={ringOpacity} side={DoubleSide} />
		</T.Mesh>
	</T.Mesh>
{/if}
