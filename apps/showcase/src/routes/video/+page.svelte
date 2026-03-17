<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import LayerBar from '$lib/components/LayerBar.svelte';
	import { VideoStudio } from '@zyeta/video-engine';
	import { MOCK_IMAGES } from '$lib/mock-data';

	let studio: ReturnType<typeof VideoStudio> | undefined = $state();

	function handleGenerate() {
		setTimeout(() => {
			studio?.setGeneratedVideo(
				'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
			);
		}, 2000);
	}
</script>

<svelte:head>
	<title>Video Studio - Zyeta Showcase</title>
</svelte:head>

<div class="flex min-h-screen flex-col gap-6 p-6 sm:p-8">
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
		<div class="flex items-center gap-4">
			<a
				href="/"
				class="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-400 backdrop-blur-sm transition-colors hover:bg-slate-950 hover:text-white"
			>
				<ArrowLeft class="h-4 w-4" />
				Showcase
			</a>
			<div>
				<h1 class="text-lg font-semibold text-white">Video Studio</h1>
				<p class="text-xs text-slate-400">Select images and generate a video</p>
			</div>
		</div>

		<VideoStudio bind:this={studio} images={MOCK_IMAGES} ongenerate={handleGenerate} />
	</div>

	<LayerBar />
</div>
