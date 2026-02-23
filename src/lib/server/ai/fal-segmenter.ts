import { fal } from '@fal-ai/client';
import { getRequestEvent } from '$app/server';
import { configureFal } from './fal-config';
import type { ImageSegmenter, SegmentRequest, SegmentResult } from './types';

export function createFalSegmenter(): ImageSegmenter {
	configureFal();

	return {
		async segment(request: SegmentRequest): Promise<SegmentResult> {
			// Resolve local paths to full URLs for fal.ai
			let imageUrl = request.imageUrl;
			if (imageUrl.startsWith('/')) {
				const origin = getRequestEvent()?.url?.origin;
				if (!origin) throw new Error('Cannot resolve local path: no request context');
				const response = await fetch(`${origin}${encodeURI(imageUrl)}`);
				if (!response.ok) throw new Error(`Failed to fetch local asset: ${response.status}`);
				const blob = await response.blob();
				imageUrl = await fal.storage.upload(blob);
			}

			const result = await fal.subscribe('fal-ai/sam2/image', {
				input: {
					image_url: imageUrl,
					prompts: request.points.map(([x, y]) => ({ x, y, label: '1' as const }))
				}
			});

			const resultData = result.data as { masks?: Array<{ url: string }> };
			if (!resultData.masks || resultData.masks.length === 0) {
				throw new Error('No mask returned from segmentation');
			}

			return {
				maskUrl: resultData.masks[0].url
			};
		}
	};
}
