import { fal } from '@fal-ai/client';
import { configureFal, resolveImageForFal } from './fal-config';
import type { FalEnv } from './fal-config';
import type { ModelGenerator, ModelGenerateResult } from './types';

export function createFalModelGenerator(env: FalEnv, requestOrigin?: string): ModelGenerator {
	configureFal(env);

	return {
		async generate(imageUrl: string): Promise<ModelGenerateResult> {
			const resolvedUrl = await resolveImageForFal(imageUrl, env, requestOrigin);

			const result = await fal.subscribe('fal-ai/hunyuan3d-v3/image-to-3d', {
				input: {
					input_image_url: resolvedUrl,
					enable_pbr: true,
					face_count: 100000,
					generate_type: 'Normal' as const
				}
			});

			const resultData = result.data as { model_glb?: { url: string } };
			if (!resultData.model_glb?.url) {
				throw new Error('No 3D model returned from Hunyuan3D v3');
			}

			return { modelUrl: resultData.model_glb.url };
		}
	};
}
