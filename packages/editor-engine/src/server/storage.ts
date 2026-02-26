import { getRequestEvent } from '$app/server';

function getR2BaseUrl(): string | null {
	const event = getRequestEvent();
	const publicUrl = event?.platform?.env?.R2_PUBLIC_URL;
	const isLocal = event?.url?.hostname === 'localhost';
	if (isLocal) return '/api/r2';
	return publicUrl ?? null;
}

// Trusted domains that fal.ai returns files from
const TRUSTED_DOMAINS = ['fal.media', 'v3.fal.media', 'v3b.fal.media', 'storage.googleapis.com'];

interface PersistOptions {
	/** Max file size in bytes */
	maxSize: number;
	/** File extension (e.g. 'png') */
	extension: string;
	/** Fallback MIME type if response doesn't include content-type */
	fallbackContentType: string;
	/** Label for error messages */
	label: string;
}

const IMAGE_OPTIONS: PersistOptions = {
	maxSize: 20 * 1024 * 1024, // 20MB
	extension: 'png',
	fallbackContentType: 'image/png',
	label: 'Image'
};

/**
 * Download a file from a trusted source and persist it to R2.
 * Returns the permanent R2 URL.
 *
 * Includes SSRF protection (HTTPS-only, domain allowlist)
 * and size limits to prevent abuse.
 */
async function persistToR2(sourceUrl: string, options: PersistOptions): Promise<string> {
	// Already persisted (local paths or known R2 public URL)
	if (sourceUrl.startsWith('/api/r2/') || sourceUrl.startsWith('/assets/')) {
		return sourceUrl;
	}
	const r2PublicUrl = getRequestEvent()?.platform?.env?.R2_PUBLIC_URL;
	if (r2PublicUrl && sourceUrl.startsWith(r2PublicUrl)) {
		return sourceUrl;
	}

	const platform = getRequestEvent()?.platform;
	const r2 = platform?.env?.R2_IMAGES;
	const baseUrl = getR2BaseUrl();

	if (!r2 || !baseUrl) {
		throw new Error(`${options.label} storage not available`);
	}

	// SSRF protection: HTTPS-only + trusted AI provider domains
	const url = new URL(sourceUrl);
	if (url.protocol !== 'https:') {
		throw new Error('Only HTTPS URLs are allowed');
	}
	const r2Host = platform?.env?.R2_PUBLIC_URL?.replace(/^https?:\/\//, '');
	const allowed = [...TRUSTED_DOMAINS, r2Host].filter(Boolean);
	if (!allowed.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
		throw new Error(`${options.label} URL not from a trusted source`);
	}

	const response = await fetch(sourceUrl, { redirect: 'error' });
	if (!response.ok) throw new Error(`${options.label} download failed: ${response.status}`);

	const contentLength = response.headers.get('content-length');
	if (contentLength && parseInt(contentLength, 10) > options.maxSize) {
		throw new Error(`${options.label} too large: ${contentLength} bytes (max ${options.maxSize})`);
	}

	const buffer = await response.arrayBuffer();
	if (buffer.byteLength > options.maxSize) {
		throw new Error(
			`${options.label} too large: ${buffer.byteLength} bytes (max ${options.maxSize})`
		);
	}

	const filename = `${crypto.randomUUID()}.${options.extension}`;

	await r2.put(filename, buffer, {
		httpMetadata: {
			contentType: response.headers.get('content-type') || options.fallbackContentType,
			cacheControl: 'public, max-age=31536000'
		}
	});

	return `${baseUrl}/${filename}`;
}

/** Persist an AI-generated image to R2. */
export function persistImage(sourceUrl: string): Promise<string> {
	return persistToR2(sourceUrl, IMAGE_OPTIONS);
}
