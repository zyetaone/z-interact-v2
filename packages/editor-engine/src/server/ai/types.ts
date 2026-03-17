export interface ImageEditRequest {
	imageUrl: string;
	prompt: string;
	maskUrl?: string; // Data URI or URL
	assetUrl?: string; // Data URI or URL (reference asset)
	tool?: 'draw' | 'brush' | 'magic' | 'poly';
	mode?: 'add' | 'subtract' | 'modify';
	strength?: number; // 0.0 to 1.0 (default 0.75)
}

export interface ImageEditResult {
	imageUrl: string;
}

export interface ImageEditor {
	edit(request: ImageEditRequest): Promise<ImageEditResult>;
}

export interface SegmentRequest {
	imageUrl: string;
	points: Array<[number, number]>; // [x, y] coordinates
}

export interface SegmentResult {
	maskUrl: string; // The resulting mask data URI or URL
}

export interface ImageSegmenter {
	segment(request: SegmentRequest): Promise<SegmentResult>;
}

export interface ModelGenerateResult {
	modelUrl: string;
}

export interface ModelGenerator {
	generate(imageUrl: string): Promise<ModelGenerateResult>;
}
