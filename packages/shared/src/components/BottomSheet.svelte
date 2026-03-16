<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		snap = $bindable<'collapsed' | 'peek' | 'full'>('peek'),
		disabled = false,
		children,
		fullContent
	}: {
		snap: 'collapsed' | 'peek' | 'full';
		disabled?: boolean;
		children: Snippet;
		fullContent?: Snippet;
	} = $props();

	const COLLAPSED_H = 56;
	const PEEK_H = 220;
	const FULL_RATIO = 0.85;

	let sheetEl: HTMLDivElement | undefined = $state();
	let fullHeight = $state(typeof window !== 'undefined' ? window.innerHeight * FULL_RATIO : 600);
	let currentY = $state(0);
	let isDragging = $state(false);

	// Track drag state outside of $state for perf (pointer events)
	let dragStartY = 0;
	let dragStartHeight = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0;

	// Animation state
	let animating = false;
	let animationId = 0;

	const snapHeight = $derived.by(() => {
		if (snap === 'collapsed') return COLLAPSED_H;
		if (snap === 'peek') return PEEK_H;
		return fullHeight;
	});

	const displayHeight = $derived(isDragging ? currentY : snapHeight);

	// Update fullHeight on viewport resize (handles virtual keyboard)
	$effect(() => {
		if (typeof window === 'undefined') return;
		const vv = window.visualViewport;
		if (!vv) return;

		const onResize = () => {
			fullHeight = (vv.height ?? window.innerHeight) * FULL_RATIO;
		};
		vv.addEventListener('resize', onResize);
		return () => vv.removeEventListener('resize', onResize);
	});

	// Body scroll lock when fully expanded
	$effect(() => {
		if (snap === 'full') {
			document.body.classList.add('body-scroll-lock');
		} else {
			document.body.classList.remove('body-scroll-lock');
		}
		return () => document.body.classList.remove('body-scroll-lock');
	});

	// Sync currentY when snap changes externally
	$effect(() => {
		if (!isDragging) {
			currentY = snapHeight;
		}
	});

	function handlePointerDown(e: PointerEvent) {
		if (disabled) return;
		isDragging = true;
		dragStartY = e.clientY;
		dragStartHeight = snapHeight;
		lastY = e.clientY;
		lastTime = Date.now();
		velocity = 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const delta = dragStartY - e.clientY;
		const now = Date.now();
		const dt = now - lastTime;

		if (dt > 0) {
			velocity = (lastY - e.clientY) / dt; // positive = swiping up
		}
		lastY = e.clientY;
		lastTime = now;

		currentY = Math.max(COLLAPSED_H, Math.min(fullHeight, dragStartHeight + delta));
	}

	function handlePointerUp() {
		if (!isDragging) return;
		isDragging = false;

		// Velocity-based snap (flick detection)
		const FLICK_THRESHOLD = 0.5; // px/ms
		let target: 'collapsed' | 'peek' | 'full';

		if (velocity > FLICK_THRESHOLD) {
			// Flicked up
			target = snap === 'collapsed' ? 'peek' : 'full';
		} else if (velocity < -FLICK_THRESHOLD) {
			// Flicked down
			target = snap === 'full' ? 'peek' : 'collapsed';
		} else {
			// Position-based snap (find nearest)
			const points = [
				{ name: 'collapsed' as const, h: COLLAPSED_H },
				{ name: 'peek' as const, h: PEEK_H },
				{ name: 'full' as const, h: fullHeight }
			];
			target = points.reduce((closest, p) =>
				Math.abs(p.h - currentY) < Math.abs(closest.h - currentY) ? p : closest
			).name;
		}

		animateTo(target);
	}

	function animateTo(target: 'collapsed' | 'peek' | 'full') {
		const targetH = target === 'collapsed' ? COLLAPSED_H : target === 'peek' ? PEEK_H : fullHeight;
		const startH = currentY;
		const startTime = performance.now();
		const duration = 250; // ms

		if (animating) cancelAnimationFrame(animationId);
		animating = true;

		function tick(now: number) {
			const elapsed = now - startTime;
			const t = Math.min(elapsed / duration, 1);
			// ease-out cubic
			const eased = 1 - Math.pow(1 - t, 3);
			currentY = startH + (targetH - startH) * eased;

			if (t < 1) {
				animationId = requestAnimationFrame(tick);
			} else {
				animating = false;
				currentY = targetH;
				snap = target;
			}
		}

		animationId = requestAnimationFrame(tick);
	}

	function handleBackdropClick() {
		animateTo('peek');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (snap === 'collapsed') animateTo('peek');
			else if (snap === 'peek') animateTo('full');
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (snap === 'full') animateTo('peek');
			else if (snap === 'peek') animateTo('collapsed');
		}
	}
</script>

{#if !disabled}
	<!-- Backdrop (visible when full) -->
	{#if snap === 'full' || (isDragging && currentY > PEEK_H + 40)}
		<button
			class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
			style="opacity: {Math.min(1, (displayHeight - PEEK_H) / (fullHeight - PEEK_H))}"
			onclick={handleBackdropClick}
			aria-label="Close sheet"
		></button>
	{/if}

	<!-- Sheet -->
	<div
		bind:this={sheetEl}
		class="sheet-safe-area fixed right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#0f111a]/98 backdrop-blur-xl"
		style="height: {displayHeight}px; will-change: height"
		role="dialog"
		aria-label="Editor panel"
	>
		<!-- Drag handle -->
		<div
			class="flex h-12 flex-shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
			role="slider"
			aria-label="Resize panel"
			aria-valuemin={COLLAPSED_H}
			aria-valuemax={fullHeight}
			aria-valuenow={displayHeight}
			tabindex="0"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
			onkeydown={handleKeydown}
		>
			<div class="h-1.5 w-12 rounded-full bg-white/40"></div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
			{#if snap === 'full' || (isDragging && currentY > PEEK_H + 40)}
				{#if fullContent}
					{@render fullContent()}
				{:else}
					{@render children()}
				{/if}
			{:else}
				{@render children()}
			{/if}
		</div>
	</div>
{/if}
