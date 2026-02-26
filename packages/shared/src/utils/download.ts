export async function downloadImage(url: string, filename: string) {
	if (!url) return;

	try {
		const response = await fetch(url);
		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = blobUrl;
		a.download = filename;
		a.click();

		URL.revokeObjectURL(blobUrl);
	} catch {
		// Validate URL scheme before opening to prevent open redirect/XSS
		try {
			const parsed = new URL(url, window.location.origin);
			if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
				window.open(parsed.href, '_blank');
			}
		} catch {
			// Invalid URL — silently ignore
		}
	}
}
