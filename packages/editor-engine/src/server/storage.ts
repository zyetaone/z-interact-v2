// Trusted domains that fal.ai returns files from
const TRUSTED_DOMAINS = ['fal.media', 'v3.fal.media', 'v3b.fal.media', 'storage.googleapis.com']

export interface StorageEnv {
	R2_IMAGES: R2Bucket
	R2_PUBLIC_URL?: string
}

interface PersistOptions {
	/** Max file size in bytes */
	maxSize: number
	/** File extension (e.g. 'png') */
	extension: string
	/** Fallback MIME type if response doesn't include content-type */
	fallbackContentType: string
	/** Label for error messages */
	label: string
}

const IMAGE_OPTIONS: PersistOptions = {
	maxSize: 20 * 1024 * 1024, // 20MB
	extension: 'png',
	fallbackContentType: 'image/png',
	label: 'Image'
}

/**
 * Determine the base URL for R2 image access.
 * Returns '/api/r2' for local dev, the public URL for production.
 */
function getR2BaseUrl(env: StorageEnv, isLocal: boolean): string | null {
	if (isLocal) return '/api/r2'
	return env.R2_PUBLIC_URL ?? null
}

/**
 * Download a file from a trusted source and persist it to R2.
 * Returns the permanent R2 URL.
 *
 * Includes SSRF protection (HTTPS-only, domain allowlist)
 * and size limits to prevent abuse.
 */
async function persistToR2(
	sourceUrl: string,
	options: PersistOptions,
	env: StorageEnv,
	isLocal: boolean
): Promise<string> {
	// Already persisted (local paths or known R2 public URL)
	if (sourceUrl.startsWith('/api/r2/') || sourceUrl.startsWith('/assets/')) {
		return sourceUrl
	}
	if (env.R2_PUBLIC_URL && sourceUrl.startsWith(env.R2_PUBLIC_URL)) {
		return sourceUrl
	}

	const r2 = env.R2_IMAGES
	const baseUrl = getR2BaseUrl(env, isLocal)

	if (!r2 || !baseUrl) {
		throw new Error(`${options.label} storage not available`)
	}

	// SSRF protection: HTTPS-only + trusted AI provider domains
	const url = new URL(sourceUrl)
	if (url.protocol !== 'https:') {
		throw new Error('Only HTTPS URLs are allowed')
	}
	const r2Host = env.R2_PUBLIC_URL?.replace(/^https?:\/\//, '')
	const allowed = [...TRUSTED_DOMAINS, r2Host].filter(Boolean)
	if (!allowed.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
		throw new Error(`${options.label} URL not from a trusted source`)
	}

	const response = await fetch(sourceUrl, { redirect: 'error' })
	if (!response.ok) throw new Error(`${options.label} download failed: ${response.status}`)

	const contentLength = response.headers.get('content-length')
	if (contentLength && parseInt(contentLength, 10) > options.maxSize) {
		throw new Error(`${options.label} too large: ${contentLength} bytes (max ${options.maxSize})`)
	}

	const buffer = await response.arrayBuffer()
	if (buffer.byteLength > options.maxSize) {
		throw new Error(
			`${options.label} too large: ${buffer.byteLength} bytes (max ${options.maxSize})`
		)
	}

	const filename = `${crypto.randomUUID()}.${options.extension}`

	await r2.put(filename, buffer, {
		httpMetadata: {
			contentType: response.headers.get('content-type') || options.fallbackContentType,
			cacheControl: 'public, max-age=31536000'
		}
	})

	return `${baseUrl}/${filename}`
}

/** Persist an AI-generated image to R2. */
export function persistImage(
	sourceUrl: string,
	env: StorageEnv,
	isLocal: boolean
): Promise<string> {
	return persistToR2(sourceUrl, IMAGE_OPTIONS, env, isLocal)
}
