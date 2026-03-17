<script>
	import { PenTool, Globe, Film } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Zyeta Showcase</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
	<div class="text-center">
		<p class="text-xs font-medium tracking-widest text-slate-500 uppercase">
			Zyeta Workspace Studio
		</p>
		<h1 class="mt-2 text-4xl font-bold tracking-tight">Engine Showcase</h1>
		<p class="mt-2 text-base text-slate-400">Standalone demos of the creative engines</p>
	</div>

	<div class="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
		<a
			href="/editor"
			class="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 transition-all duration-200 hover:border-purple-500/30 hover:bg-purple-500/5 active:scale-[0.98]"
		>
			<PenTool
				class="h-10 w-10 text-purple-400 transition-transform duration-200 group-hover:scale-110"
			/>
			<span class="text-base font-medium">2D Editor</span>
			<span class="text-sm text-slate-400 transition-colors group-hover:text-slate-300"
				>AI image editing</span
			>
		</a>

		<a
			href="/world"
			class="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 transition-all duration-200 hover:border-cyan-500/30 hover:bg-cyan-500/5 active:scale-[0.98]"
		>
			<Globe
				class="h-10 w-10 text-cyan-400 transition-transform duration-200 group-hover:scale-110"
			/>
			<span class="text-base font-medium">3D World</span>
			<span class="text-sm text-slate-400 transition-colors group-hover:text-slate-300"
				>Isometric scene</span
			>
		</a>

		<a
			href="/video"
			class="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 transition-all duration-200 hover:border-amber-500/30 hover:bg-amber-500/5 active:scale-[0.98]"
		>
			<Film
				class="h-10 w-10 text-amber-400 transition-transform duration-200 group-hover:scale-110"
			/>
			<span class="text-base font-medium">Video Studio</span>
			<span class="text-sm text-slate-400 transition-colors group-hover:text-slate-300"
				>Image-to-video</span
			>
		</a>
	</div>
</div>
