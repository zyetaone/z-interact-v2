import { createFalEditor } from './fal-editor';
import { createFalSegmenter } from './fal-segmenter';
import type { ImageEditor, ImageSegmenter } from './types';

export type {
	ImageEditor,
	ImageEditRequest,
	ImageEditResult,
	ImageSegmenter,
	SegmentRequest,
	SegmentResult
} from './types';

export type { VideoGenerateRequest, VideoGenerateResult } from './fal-video';
export { generateVideoClip } from './fal-video';

export { resolveImageForFal } from './fal-config';
export { getWorkersAI } from './workers-ai';

export function createImageEditor(): ImageEditor {
	return createFalEditor();
}

export function createImageSegmenter(): ImageSegmenter {
	return createFalSegmenter();
}
