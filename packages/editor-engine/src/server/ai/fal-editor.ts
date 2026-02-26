import { fal } from '@fal-ai/client';
import { getRequestEvent } from '$app/server';
import { configureFal } from './fal-config';
import type { ImageEditor, ImageEditRequest, ImageEditResult } from './types';

interface ImageDimensions {
	width: number;
	height: number;
}

/** Max pixel size on longest side for Flux Inpainting */
const FLUX_MAX_SIZE = 1440;

/**
 * Extract image dimensions by fetching just the header bytes.
 * Supports PNG, JPEG, and WebP formats.
 */
async function getImageDimensions(input: string): Promise<ImageDimensions | null> {
	try {
		let buffer: ArrayBuffer;

		if (input.startsWith('data:')) {
			const match = input.match(/^data:[^;]+;base64,(.+)$/);
			if (!match) return null;
			const raw = atob(match[1]);
			const len = Math.min(raw.length, 65536);
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) bytes[i] = raw.charCodeAt(i);
			buffer = bytes.buffer;
		} else {
			const url = input.startsWith('/') ? `${getRequestEvent()?.url?.origin}${input}` : input;
			const response = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
			buffer = await response.arrayBuffer();
		}

		const view = new DataView(buffer);
		if (buffer.byteLength < 24) return null;

		// PNG: signature 89 50 4E 47, dimensions in IHDR at bytes 16-23
		if (view.getUint8(0) === 0x89 && view.getUint8(1) === 0x50) {
			return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
		}

		// JPEG: SOI marker FF D8, scan for SOF markers
		if (view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8) {
			let offset = 2;
			while (offset < buffer.byteLength - 9) {
				if (view.getUint8(offset) !== 0xff) {
					offset++;
					continue;
				}
				const marker = view.getUint8(offset + 1);
				if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xcc) {
					return {
						height: view.getUint16(offset + 5, false),
						width: view.getUint16(offset + 7, false)
					};
				}
				if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS — stop scanning
				const segLen = view.getUint16(offset + 2, false);
				offset += 2 + segLen;
			}
		}

		// WebP: RIFF....WEBP
		if (
			buffer.byteLength >= 30 &&
			view.getUint32(0, false) === 0x52494646 &&
			view.getUint32(8, false) === 0x57454250
		) {
			const c12 = view.getUint8(12);
			const c13 = view.getUint8(13);
			const c14 = view.getUint8(14);
			const c15 = view.getUint8(15);
			// VP8 (lossy)
			if (c12 === 0x56 && c13 === 0x50 && c14 === 0x38 && c15 === 0x20) {
				return {
					width: view.getUint16(26, true) & 0x3fff,
					height: view.getUint16(28, true) & 0x3fff
				};
			}
			// VP8L (lossless)
			if (c12 === 0x56 && c13 === 0x50 && c14 === 0x38 && c15 === 0x4c) {
				const bits = view.getUint32(21, true);
				return {
					width: (bits & 0x3fff) + 1,
					height: ((bits >> 14) & 0x3fff) + 1
				};
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Clamp dimensions so the longest side does not exceed maxSize,
 * preserving aspect ratio.
 */
function clampDimensions(
	dims: ImageDimensions,
	maxSize: number
): { width: number; height: number } {
	const longest = Math.max(dims.width, dims.height);
	if (longest <= maxSize) return { width: dims.width, height: dims.height };
	const scale = maxSize / longest;
	return {
		width: Math.round(dims.width * scale),
		height: Math.round(dims.height * scale)
	};
}

async function uploadToFal(input: string): Promise<string> {
	// Remote URLs (HTTPS only — block plaintext HTTP to prevent SSRF/MITM)
	if (input.startsWith('https://')) {
		return input;
	}
	if (input.startsWith('http://')) {
		throw new Error('Only HTTPS URLs are allowed');
	}

	// Data URI — decode and upload to fal storage
	if (input.startsWith('data:')) {
		const match = input.match(/^data:([^;]+);base64,(.+)$/);
		if (!match) throw new Error('Invalid data URI format');
		const mimeType = match[1];
		const raw = atob(match[2]);
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
		const blob = new Blob([bytes], { type: mimeType });
		return await fal.storage.upload(blob);
	}

	// Local path (/assets/*, /uploads/*) — fetch via own origin, upload to fal
	if (input.startsWith('/')) {
		const origin = getRequestEvent()?.url?.origin;
		if (!origin) throw new Error('Cannot resolve local path: no request context');
		const response = await fetch(`${origin}${encodeURI(input)}`);
		if (!response.ok) throw new Error(`Failed to fetch local asset: ${response.status}`);
		const blob = await response.blob();
		return await fal.storage.upload(blob);
	}

	return input;
}

function composePrompt(request: ImageEditRequest): string {
	const role =
		'Expert interior workspace designer. Photorealistic, 8k, architectural-digest quality. ' +
		'Preserve structural integrity unless explicitly asked to transform.';

	let modePrompt = '';
	switch (request.mode) {
		case 'add':
			modePrompt =
				'ADD the described element. Blend naturally with existing lighting, shadows, and perspective. ' +
				'Do NOT remove or alter existing furniture.';
			break;
		case 'subtract':
			modePrompt =
				'REMOVE the described element. Fill the vacated area with contextually appropriate background ' +
				'(floor, wall, ceiling). Seamless inpainting.';
			break;
		case 'modify':
			modePrompt =
				'MODIFY the described attribute. Change ONLY the specified quality (color, material, style, lighting). ' +
				'Keep geometry and layout unchanged.';
			break;
		default:
			modePrompt = 'Apply the requested change while preserving the workspace context.';
	}

	let toolPrompt = '';
	if (request.tool === 'brush') {
		toolPrompt = 'Freehand painted area — artistic integration, seamless texture blending.';
	} else if (request.tool === 'draw' || request.tool === 'poly') {
		toolPrompt =
			'Precisely selected region — architectural alignment within the defined boundaries.';
	} else if (request.tool === 'magic') {
		toolPrompt = 'AI-selected object boundary — clean, object-aware editing.';
	}

	return [role, modePrompt, toolPrompt, request.prompt].filter(Boolean).join(' ');
}

export function createFalEditor(): ImageEditor {
	configureFal();

	return {
		async edit(request: ImageEditRequest): Promise<ImageEditResult> {
			const imageUrl = await uploadToFal(request.imageUrl);
			const prompt = composePrompt(request);

			// Read source image dimensions to preserve aspect ratio
			const sourceDims = await getImageDimensions(request.imageUrl);
			const imageSize = sourceDims ? clampDimensions(sourceDims, FLUX_MAX_SIZE) : undefined;

			// Has asset + mask → Flux Inpainting with asset described in prompt
			// The workspace image is the BASE; asset influences the prompt, not the input
			if (request.assetUrl && request.maskUrl) {
				const maskUrl = await uploadToFal(request.maskUrl);
				const result = await fal.subscribe('fal-ai/flux-lora/inpainting', {
					input: {
						prompt: `${prompt} Place the furniture/object from the reference image into the masked area. Match lighting, shadows, and perspective of the room.`,
						image_url: imageUrl,
						mask_url: maskUrl,
						strength: request.strength ?? 0.8,
						num_inference_steps: 32,
						guidance_scale: 4.0,
						num_images: 1,
						enable_safety_checker: true,
						...(imageSize && { image_size: imageSize })
					}
				});

				const images = (result.data as { images?: Array<{ url: string }> }).images;
				if (!images?.[0]?.url) {
					throw new Error('No image returned from Flux inpainting');
				}
				return { imageUrl: images[0].url };
			}

			// Has asset but NO mask → use Nano Banana Pro with workspace as primary
			if (request.assetUrl) {
				const assetUrl = await uploadToFal(request.assetUrl);
				const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
					input: {
						prompt: `${prompt} Integrate the reference object into the existing workspace. The first image is the workspace to edit — preserve its composition, aspect ratio, and structure. Use the second image only as a style/object reference.`,
						image_urls: [imageUrl, assetUrl],
						num_images: 1,
						output_format: 'png' as const,
						...(imageSize && { image_size: imageSize })
					}
				});

				const resultData = result.data as { images?: Array<{ url: string }> };
				if (!resultData.images?.[0]?.url) {
					throw new Error('No image returned from Nano Banana Pro');
				}
				return { imageUrl: resultData.images[0].url };
			}

			// Has mask → Flux Inpainting (masked region editing)
			if (request.maskUrl) {
				const maskUrl = await uploadToFal(request.maskUrl);
				const result = await fal.subscribe('fal-ai/flux-lora/inpainting', {
					input: {
						prompt,
						image_url: imageUrl,
						mask_url: maskUrl,
						strength: request.strength ?? 0.85,
						num_inference_steps: 28,
						guidance_scale: 3.5,
						num_images: 1,
						enable_safety_checker: true,
						...(imageSize && { image_size: imageSize })
					}
				});

				const images = (result.data as { images?: Array<{ url: string }> }).images;
				if (!images?.[0]?.url) {
					throw new Error('No image returned from Flux inpainting');
				}
				return { imageUrl: images[0].url };
			}

			// No mask, no asset → Nano Banana Pro (whole-image editing via prompt)
			const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
				input: {
					prompt,
					image_urls: [imageUrl],
					num_images: 1,
					output_format: 'png' as const,
					...(imageSize && { image_size: imageSize })
				}
			});

			const resultData = result.data as { images?: Array<{ url: string }> };
			if (!resultData.images?.[0]?.url) {
				throw new Error('No image returned from Nano Banana Pro');
			}
			return { imageUrl: resultData.images[0].url };
		}
	};
}
