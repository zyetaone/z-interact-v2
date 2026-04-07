/**
 * Procedural island terrain texture generator.
 *
 * Generates canvas-based grass/rock terrain textures entirely in the browser —
 * no external downloads required. Textures are cached at module level so each
 * unique island seed is only ever generated once per session.
 *
 * The palette deliberately mimics satellite / topo-map colouring so the hex
 * island tops feel like tiny terrain patches seen from above, matching the
 * "downloadable & cached map texture" aesthetic described in the issue.
 */

import { CanvasTexture, RepeatWrapping } from 'three';

// Module-level cache — survive component re-mounts
const _cache = new Map<number, CanvasTexture>();

/**
 * Simple deterministic multiplicative-hash pseudo-random number generator
 * seeded by `seed`. Applies two rounds of avalanche mixing (Wang-hash style)
 * and returns values in [0, 1).
 */
function makeRng(seed: number) {
	let s = (seed + 1) * 2654435769;
	return () => {
		s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
		s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
		s ^= s >>> 16;
		// normalise to [0, 1)
		return (s >>> 0) / 0xffffffff;
	};
}

/**
 * Return a cached `CanvasTexture` for the given island `seed` (0-based index).
 * Must be called inside a browser context (Canvas API required).
 */
export function getIslandTexture(seed: number): CanvasTexture {
	if (_cache.has(seed)) return _cache.get(seed)!;

	const SIZE = 256;
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext('2d')!;
	const rng = makeRng(seed);

	// ── Base grass layer ──────────────────────────────────────────────────────
	const baseHue = 95 + rng() * 25; // 95–120 → muted greens
	const baseLit = 16 + rng() * 8; // dark-ish
	ctx.fillStyle = `hsl(${baseHue},42%,${baseLit}%)`;
	ctx.fillRect(0, 0, SIZE, SIZE);

	// ── Low-frequency colour patches (large terrain zones) ────────────────────
	for (let i = 0; i < 12; i++) {
		const x = rng() * SIZE;
		const y = rng() * SIZE;
		const rx = 20 + rng() * 60;
		const ry = 15 + rng() * 40;
		const angle = rng() * Math.PI;
		// Randomly choose grass / dry-grass / rock / dirt
		const kind = rng();
		let h: number, s: number, l: number;
		if (kind < 0.45) {
			// Grass variation
			h = 90 + rng() * 35;
			s = 35 + rng() * 25;
			l = 14 + rng() * 12;
		} else if (kind < 0.72) {
			// Rocky grey-brown
			h = 25 + rng() * 20;
			s = 8 + rng() * 15;
			l = 20 + rng() * 14;
		} else {
			// Dry dirt / sand tint
			h = 35 + rng() * 20;
			s = 20 + rng() * 20;
			l = 20 + rng() * 10;
		}
		ctx.globalAlpha = 0.35 + rng() * 0.4;
		ctx.fillStyle = `hsl(${h},${s}%,${l}%)`;
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;

	// ── Fine grass detail (small tufts / brush strokes) ───────────────────────
	for (let i = 0; i < 350; i++) {
		const x = rng() * SIZE;
		const y = rng() * SIZE;
		const r = 1.5 + rng() * 5;
		const h = 88 + rng() * 40;
		const l = 12 + rng() * 18;
		ctx.globalAlpha = 0.4 + rng() * 0.5;
		ctx.fillStyle = `hsl(${h},38%,${l}%)`;
		ctx.beginPath();
		ctx.ellipse(x, y, r, r * (0.4 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;

	// ── Rock outcroppings ─────────────────────────────────────────────────────
	const rockCount = 3 + Math.floor(rng() * 5);
	for (let i = 0; i < rockCount; i++) {
		const x = rng() * SIZE;
		const y = rng() * SIZE;
		const r = 8 + rng() * 20;
		const h = 20 + rng() * 30;
		const l = 18 + rng() * 14;
		ctx.globalAlpha = 0.5 + rng() * 0.4;
		ctx.fillStyle = `hsl(${h},12%,${l}%)`;
		ctx.beginPath();
		ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
		// Rock highlight
		ctx.globalAlpha = 0.15 + rng() * 0.2;
		ctx.fillStyle = `hsl(${h},8%,${l + 12}%)`;
		ctx.beginPath();
		ctx.ellipse(x - r * 0.15, y - r * 0.2, r * 0.6, r * 0.3, rng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;

	// ── Subtle radial vignette at edge — gives island shape ───────────────────
	const gradient = ctx.createRadialGradient(
		SIZE / 2,
		SIZE / 2,
		SIZE * 0.25,
		SIZE / 2,
		SIZE / 2,
		SIZE * 0.72
	);
	gradient.addColorStop(0, 'rgba(0,0,0,0)');
	gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, SIZE, SIZE);

	const tex = new CanvasTexture(canvas);
	tex.wrapS = RepeatWrapping;
	tex.wrapT = RepeatWrapping;
	tex.repeat.set(1.5, 1.5);
	tex.needsUpdate = true;

	_cache.set(seed, tex);
	return tex;
}
