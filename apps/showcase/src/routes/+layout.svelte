<script>
	import './layout.css'
	let { children } = $props()
</script>

<main class="min-h-screen bg-slate-950 text-slate-100">
	{@render children()}
</main>
