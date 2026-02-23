import { fal } from '@fal-ai/client';
import { configureFal } from './fal-config';

export interface GlbGenerateRequest {
	imageUrl: string;
}

export interface GlbGenerateResult {
	glbUrl: string;
}

/**
 * Generate a GLB 3D model from a single image using fal.ai Trellis-2.
 * Input: workspace image URL (HTTPS or R2).
 * Output: GLB model URL from fal.ai (temporary — persist to R2 before returning to client).
 */
export async function generateGlb(request: GlbGenerateRequest): Promise<GlbGenerateResult> {
	configureFal();

	const result = await fal.subscribe('fal-ai/trellis-2', {
		input: {
			image_url: request.imageUrl
		}
	});

	const resultData = result.data as { model_glb?: { url: string } };
	if (!resultData.model_glb?.url) {
		throw new Error('No GLB model returned from Trellis-2');
	}

	return { glbUrl: resultData.model_glb.url };
}
