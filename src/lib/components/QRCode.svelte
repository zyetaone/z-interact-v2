<script lang="ts">
	import QRCode from 'qrcode';

	let {
		url,
		size = 200,
		class: className = ''
	}: { url: string; size?: number; class?: string } = $props();

	let dataUrl = $state('');
	let loading = $state(true);
	let err = $state('');

	$effect(() => {
		if (!url) return;

		let cancelled = false;

		(async () => {
			loading = true;
			err = '';

			try {
				const result = await QRCode.toDataURL(url, {
					width: size,
					margin: 2,
					color: { dark: '#e2e8f0', light: '#00000000' },
					errorCorrectionLevel: 'M'
				});

				if (!cancelled) {
					dataUrl = result;
				}
			} catch (e) {
				if (!cancelled) {
					err = e instanceof Error ? e.message : 'QR failed';
				}
			} finally {
				if (!cancelled) {
					loading = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="inline-block {className}">
	{#if loading}
		<div
			class="flex items-center justify-center rounded-xl bg-white/5"
			style="width: {size}px; height: {size}px;"
		>
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-purple-300/30 border-t-purple-400"
			></div>
		</div>
	{:else if err}
		<div
			class="flex items-center justify-center rounded-xl bg-rose-500/10 text-xs text-rose-300"
			style="width: {size}px; height: {size}px;"
		>
			QR Error
		</div>
	{:else}
		<img
			src={dataUrl}
			alt="QR Code for {url}"
			class="rounded-xl"
			style="width: {size}px; height: {size}px;"
		/>
	{/if}
</div>
