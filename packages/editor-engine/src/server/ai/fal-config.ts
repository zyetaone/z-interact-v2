import { fal } from '@fal-ai/client'

/** Minimal R2-compatible bucket interface (avoids @cloudflare/workers-types dep) */
export interface R2BucketLike {
	get(key: string): Promise<{
		arrayBuffer(): Promise<ArrayBuffer>
		httpMetadata?: { contentType?: string }
	} | null>
	put(key: string, value: ArrayBuffer | ReadableStream, options?: unknown): Promise<unknown>
}

export interface FalEnv {
	FAL_API_KEY: string
	CLOUDFLARE_ACCOUNT_ID?: string
	CLOUDFLARE_AI_GATEWAY_ID?: string
	CLOUDFLARE_AIG_TOKEN?: string
	R2_IMAGES?: R2BucketLike
	R2_PUBLIC_URL?: string
}

/**
 * Configure the fal.ai client with API key and optional AI Gateway proxy.
 * Call once at the start of any AI operation.
 */
export function configureFal(env: FalEnv) {
	const apiKey = env.FAL_API_KEY
	if (!apiKey) throw new Error('FAL_API_KEY not set')

	const accountId = env.CLOUDFLARE_ACCOUNT_ID
	const gatewayId = env.CLOUDFLARE_AI_GATEWAY_ID
	const aigToken = env.CLOUDFLARE_AIG_TOKEN

	if (accountId && gatewayId) {
		fal.config({
			credentials: apiKey,
			proxyUrl: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/fal-ai`,
			...(aigToken && {
				requestMiddleware: async (request) => ({
					...request,
					headers: {
						...request.headers,
						'cf-aig-authorization': `Bearer ${aigToken}`
					}
				})
			})
		})
	} else {
		fal.config({ credentials: apiKey })
	}
}

/**
 * Resolve a local R2 image URL to a publicly-accessible fal.ai storage URL.
 *
 * fal.ai models fetch images by URL from their servers — they can't reach
 * localhost or internal R2 paths. This function reads the image bytes from
 * R2 directly and uploads to fal.ai's CDN storage.
 *
 * If the URL is already HTTPS (e.g. R2 public URL or fal.media), returns as-is.
 */
export async function resolveImageForFal(
	imageUrl: string,
	env: FalEnv,
	requestOrigin?: string
): Promise<string> {
	if (imageUrl.startsWith('https://')) return imageUrl

	// R2 paths — read from R2 bucket directly and upload to fal storage
	if (imageUrl.startsWith('/api/r2/')) {
		const r2 = env.R2_IMAGES
		if (!r2) throw new Error('R2 not configured')

		const key = imageUrl.replace('/api/r2/', '')
		const object = await r2.get(key)
		if (!object) throw new Error(`Image not found in R2: ${key}`)

		const buffer = await object.arrayBuffer()
		const contentType = object.httpMetadata?.contentType || 'image/png'
		const blob = new Blob([buffer], { type: contentType })

		configureFal(env)
		const falUrl = await fal.storage.upload(blob)
		return falUrl
	}

	// Local paths (/assets/*, /uploads/*) — fetch via own origin and upload to fal storage
	if (imageUrl.startsWith('/')) {
		if (!requestOrigin) throw new Error('Cannot resolve local path: no request context')

		const response = await fetch(`${requestOrigin}${encodeURI(imageUrl)}`)
		if (!response.ok) throw new Error(`Failed to fetch local asset: ${response.status}`)
		const blob = await response.blob()

		configureFal(env)
		return await fal.storage.upload(blob)
	}

	throw new Error(`Cannot resolve image URL for fal.ai: ${imageUrl}`)
}
