<script>
	import { PenTool, Globe, Film } from '@lucide/svelte'
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
	<h1 class="text-4xl font-bold tracking-tight">Engine Showcase</h1>
	<p class="text-slate-400">Standalone demos of the Zyeta creative engines</p>

	<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
		<a
			href="/editor"
			class="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-purple-500/30 hover:bg-purple-500/5"
		>
			<PenTool class="h-12 w-12 text-purple-400 transition group-hover:scale-110" />
			<span class="text-lg font-medium">2D Editor</span>
			<span class="text-sm text-slate-500">AI-powered image editing</span>
		</a>

		<a
			href="/world"
			class="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-cyan-500/30 hover:bg-cyan-500/5"
		>
			<Globe class="h-12 w-12 text-cyan-400 transition group-hover:scale-110" />
			<span class="text-lg font-medium">3D World</span>
			<span class="text-sm text-slate-500">Isometric scene viewer</span>
		</a>

		<a
			href="/video"
			class="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 transition hover:border-amber-500/30 hover:bg-amber-500/5"
		>
			<Film class="h-12 w-12 text-amber-400 transition group-hover:scale-110" />
			<span class="text-lg font-medium">Video Studio</span>
			<span class="text-sm text-slate-500">Image-to-video generation</span>
		</a>
	</div>
</div>
