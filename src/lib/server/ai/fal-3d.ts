import { fal } from '@fal-ai/client';
import { configureFal } from './fal-config';

export interface GlbGenerateRequest {
	imageUrl: string;
}

export interface GlbGenerateResult {
	glbUrl: string;
}

/**
 * Generate a GLB 3D model from a single image using Hunyuan 3D v3.1 Rapid.
 * Input: workspace image URL (must be HTTPS — use resolveImageForFal first).
 * Output: GLB model URL from fal.ai (temporary — persist to R2 before returning to client).
 */
export async function generateGlb(request: GlbGenerateRequest): Promise<GlbGenerateResult> {
	configureFal();

	const result = await fal.subscribe('fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d', {
		input: {
			input_image_url: request.imageUrl,
			enable_pbr: true
		}
	});

	const resultData = result.data as { model_glb?: { url: string } };
	if (!resultData.model_glb?.url) {
		throw new Error('No GLB model returned from Hunyuan 3D');
	}

	return { glbUrl: resultData.model_glb.url };
}
