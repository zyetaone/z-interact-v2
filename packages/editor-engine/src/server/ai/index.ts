import { createFalEditor } from './fal-editor'
import { createFalSegmenter } from './fal-segmenter'
import type { FalEnv } from './fal-config'
import type { ImageEditor, ImageSegmenter } from './types'

export type { FalEnv } from './fal-config'
export type {
	ImageEditor,
	ImageEditRequest,
	ImageEditResult,
	ImageSegmenter,
	SegmentRequest,
	SegmentResult
} from './types'

export function createImageEditor(env: FalEnv, requestOrigin?: string): ImageEditor {
	return createFalEditor(env, requestOrigin)
}

export function createImageSegmenter(env: FalEnv, requestOrigin?: string): ImageSegmenter {
	return createFalSegmenter(env, requestOrigin)
}
