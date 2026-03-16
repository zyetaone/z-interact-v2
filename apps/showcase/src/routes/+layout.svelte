<script>
	import './layout.css';
	let { children } = $props();
</script>

<main class="min-h-screen text-slate-100">
	{@render children()}
</main>
