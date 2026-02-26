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

export function createImageEditor(): ImageEditor {
	return createFalEditor();
}

export function createImageSegmenter(): ImageSegmenter {
	return createFalSegmenter();
}
