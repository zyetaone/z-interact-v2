import { fal } from '@fal-ai/client';
import { getRequestEvent } from '$app/server';

/**
 * Configure the fal.ai client with API key and optional AI Gateway proxy.
 * Call once at the start of any AI operation.
 *
 * Reads FAL_API_KEY from Cloudflare platform env (production)
 * or process.env (local dev). Optionally routes through Cloudflare
 * AI Gateway when CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_GATEWAY_ID are set.
 */
export function configureFal() {
	const platform = getRequestEvent()?.platform;
	const env = platform?.env;
	const apiKey = env?.FAL_API_KEY || process.env.FAL_API_KEY;
	if (!apiKey) throw new Error('FAL_API_KEY not set');

	if (env?.CLOUDFLARE_ACCOUNT_ID && env?.CLOUDFLARE_AI_GATEWAY_ID) {
		fal.config({
			credentials: apiKey,
			proxyUrl: `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_AI_GATEWAY_ID}/fal-ai`
		});
	} else {
		fal.config({ credentials: apiKey });
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
export async function resolveImageForFal(imageUrl: string): Promise<string> {
	if (imageUrl.startsWith('https://')) return imageUrl;

	if (!imageUrl.startsWith('/api/r2/')) {
		throw new Error(`Cannot resolve image URL for fal.ai: ${imageUrl}`);
	}

	const platform = getRequestEvent()?.platform;
	const r2 = platform?.env?.R2_IMAGES;
	if (!r2) throw new Error('R2 not configured');

	// Extract the R2 key from the path: /api/r2/uuid.png → uuid.png
	const key = imageUrl.replace('/api/r2/', '');

	const object = await r2.get(key);
	if (!object) throw new Error(`Image not found in R2: ${key}`);

	const buffer = await object.arrayBuffer();
	const contentType = object.httpMetadata?.contentType || 'image/png';
	const blob = new Blob([buffer], { type: contentType });

	configureFal();
	const falUrl = await fal.storage.upload(blob);
	return falUrl;
}
