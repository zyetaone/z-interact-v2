import { fal } from '@fal-ai/client';
import { configureFal } from './fal-config';

export interface VideoGenerateRequest {
	imageUrl: string;
	prompt?: string;
}

export interface VideoGenerateResult {
	videoUrl: string;
}

/** Camera movement prompts to cycle through for variety */
const CAMERA_PROMPTS = [
	'[Slow zoom in] Elegant workspace interior, subtle ambient movement, warm natural lighting',
	'[Pan left] Modern office design, gentle lighting shifts, professional atmosphere',
	'[Push in] Professional workspace, cinematic depth reveal, clean lines',
	'[Pedestal up] Elegant office space, rising perspective, architectural beauty',
	'[Tracking shot] Contemporary workspace, smooth lateral movement, design showcase'
];

/**
 * Generate a short video clip from a single image using MiniMax Video 01.
 * Returns a URL to the generated video (~5 seconds, 720p).
 */
export async function generateVideoClip(
	request: VideoGenerateRequest,
	index: number = 0
): Promise<VideoGenerateResult> {
	configureFal();

	const prompt = request.prompt || CAMERA_PROMPTS[index % CAMERA_PROMPTS.length];

	const result = await fal.subscribe('fal-ai/minimax/video-01/image-to-video', {
		input: {
			image_url: request.imageUrl,
			prompt
		}
	});

	const resultData = result.data as { video?: { url: string } };
	if (!resultData.video?.url) {
		throw new Error('No video returned from MiniMax Video 01');
	}

	return { videoUrl: resultData.video.url };
}
