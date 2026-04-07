<script lang="ts">
	/**
	 * FloatingParticles — ambient dust-mote / firefly effect.
	 *
	 * Renders a cloud of small glowing points that drift lazily around the scene,
	 * giving the floating-island world a magical, atmospheric feel.
	 * A single THREE.js Points object is used for all particles (GPU efficient).
	 */
	import { T, useTask } from '@threlte/core';
	import { BufferGeometry, Float32BufferAttribute, AdditiveBlending } from 'three';

	const COUNT = 140;
	const SPREAD_XZ = 48; // horizontal spread (world units)
	const HEIGHT_MIN = 0.3;
	const HEIGHT_MAX = 9;

	// Per-particle data (stored flat for BufferGeometry)
	const pos = new Float32Array(COUNT * 3);
	const speeds = new Float32Array(COUNT); // vertical drift speed
	const driftPhase = new Float32Array(COUNT); // horizontal sway phase
	const driftAmp = new Float32Array(COUNT); // horizontal sway amplitude

	for (let i = 0; i < COUNT; i++) {
		pos[i * 3] = (Math.random() - 0.5) * SPREAD_XZ;
		pos[i * 3 + 1] = HEIGHT_MIN + Math.random() * (HEIGHT_MAX - HEIGHT_MIN);
		pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_XZ;
		speeds[i] = 0.0008 + Math.random() * 0.0018;
		driftPhase[i] = Math.random() * Math.PI * 2;
		driftAmp[i] = 0.002 + Math.random() * 0.004;
	}

	const geometry = new BufferGeometry();
	const posAttr = new Float32BufferAttribute(pos, 3);
	geometry.setAttribute('position', posAttr);

	// Animate every frame — update Y (vertical float) and XZ (sway)
	// Asymmetric X/Z frequencies (60 vs 50) create a natural-looking figure-eight
	// Lissajous drift rather than perfectly circular motion.
	const SWAY_FREQ_X = 60;
	const SWAY_FREQ_Z = 50;

	useTask(() => {
		const t = performance.now() * 0.001;
		for (let i = 0; i < COUNT; i++) {
			// Rise slowly; wrap back to bottom when reaching the top
			pos[i * 3 + 1] += speeds[i];
			if (pos[i * 3 + 1] > HEIGHT_MAX) {
				pos[i * 3 + 1] = HEIGHT_MIN;
				// Respawn at a random XZ so it doesn't look looping
				pos[i * 3] = (Math.random() - 0.5) * SPREAD_XZ;
				pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_XZ;
			}
			// Gentle horizontal sway
			pos[i * 3] += Math.sin(t * speeds[i] * SWAY_FREQ_X + driftPhase[i]) * driftAmp[i];
			pos[i * 3 + 2] += Math.cos(t * speeds[i] * SWAY_FREQ_Z + driftPhase[i]) * driftAmp[i];
		}
		posAttr.needsUpdate = true;
	});
</script>

<!-- Additive blending makes overlapping particles glow brighter -->
<T.Points {geometry}>
	<T.PointsMaterial
		color={0xc4aaff}
		size={0.07}
		transparent
		opacity={0.65}
		sizeAttenuation
		depthWrite={false}
		blending={AdditiveBlending}
	/>
</T.Points>
