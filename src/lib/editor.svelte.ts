import type { MaskRect, MaskPath, MaskPolygon, MaskData } from '$lib/types/workspace';

export class Editor {
	// Prompt state
	prompt = $state('');
	mode = $state<'add' | 'subtract' | 'modify'>('add');
	strength = $state(0.75);

	// Mask state
	isDrawing = $state(false);
	maskTool = $state<'draw' | 'magic' | 'brush' | 'poly'>('draw');
	rects = $state<MaskRect[]>([]);
	paths = $state<MaskPath[]>([]);
	polygons = $state<MaskPolygon[]>([]);
	tempRect = $state<MaskRect | null>(null);
	tempPath = $state<MaskPath | null>(null);
	tempPoly = $state<MaskPolygon | null>(null);
	nextRectId = 0;
	nextPathId = 0;
	nextPolygonId = 0; // Added this based on pattern for nextId
	brushSize = $state(40);

	// AI mask (from segmentation)
	aiMaskUrl = $state<string | null>(null);
	assetUrl = $state<string | null>(null);

	// Derived
	readonly hasPrompt = $derived(this.prompt.trim().length > 0);
	readonly hasMask = $derived(
		this.rects.length > 0 || this.paths.length > 0 || this.polygons.length > 0 || !!this.aiMaskUrl
	);
	readonly canGenerate = $derived(this.hasPrompt || this.hasMask);
	get maskData(): MaskData | undefined {
		if (!this.hasMask) return;
		return {
			rects: this.rects,
			paths: this.paths,
			polygons: this.polygons,
			tool: this.maskTool,
			aiMaskUrl: this.aiMaskUrl,
			assetUrl: this.assetUrl
		};
	}

	// Actions
	setMode(mode: 'add' | 'subtract' | 'modify') {
		this.mode = mode;
	}

	addSuggestion(chip: string) {
		this.prompt += (this.prompt ? ', ' : '') + chip;
	}

	startDrawing(x: number, y: number) {
		this.isDrawing = true;
		this.tempRect = { id: this.nextRectId++, x, y, w: 0, h: 0 };
	}

	updateDrawing(x: number, y: number) {
		if (!this.isDrawing || !this.tempRect) return;
		this.tempRect.w = x - this.tempRect.x;
		this.tempRect.h = y - this.tempRect.y;
	}

	finishDrawing() {
		if (this.tempRect) {
			// Normalize negative dimensions
			if (this.tempRect.w < 0) {
				this.tempRect.x += this.tempRect.w;
				this.tempRect.w = Math.abs(this.tempRect.w);
			}
			if (this.tempRect.h < 0) {
				this.tempRect.y += this.tempRect.h;
				this.tempRect.h = Math.abs(this.tempRect.h);
			}
			this.rects = [...this.rects, this.tempRect];
		}
		this.isDrawing = false;
		this.tempRect = null;
	}

	updateRect(idx: number, updates: Partial<{ x: number; y: number; w: number; h: number }>) {
		const r = this.rects[idx];
		if (!r) return;
		this.rects[idx] = { ...r, ...updates };
	}

	deleteRect(id: number) {
		this.rects = this.rects.filter((r) => r.id !== id);
	}

	// Brush drawing
	startBrushStroke(x: number, y: number) {
		this.isDrawing = true;
		this.tempPath = {
			id: this.nextPathId++,
			points: [{ x, y }],
			strokeWidth: this.brushSize
		};
	}

	continueBrushStroke(x: number, y: number) {
		if (!this.tempPath) return;
		this.tempPath.points = [...this.tempPath.points, { x, y }];
	}

	finishBrushStroke() {
		if (this.tempPath) {
			this.paths = [...this.paths, this.tempPath];
		}
		this.isDrawing = false;
		this.tempPath = null;
	}

	deletePath(id: number) {
		this.paths = this.paths.filter((p) => p.id !== id);
	}

	// Polygon drawing
	startPolygon(x: number, y: number) {
		this.isDrawing = true;
		// Create a quad with 4 points at the same location (will be dragged out)
		this.tempPoly = {
			id: this.nextPolygonId++,
			points: [
				{ x: x - 10, y: y - 10 },
				{ x: x + 10, y: y - 10 },
				{ x: x + 10, y: y + 10 },
				{ x: x - 10, y: y + 10 }
			]
		};
	}

	updatePolygonVertex(polyId: number, vertexIdx: number, x: number, y: number) {
		const poly = this.polygons.find((p) => p.id === polyId);
		if (poly) {
			poly.points[vertexIdx] = { x, y };
		}
	}

	finishPolygon() {
		if (this.tempPoly) {
			this.polygons = [...this.polygons, this.tempPoly];
		}
		this.isDrawing = false;
		this.tempPoly = null;
	}

	finishDrawingAsPoly() {
		if (!this.tempRect) return;
		// Normalize negative dimensions
		let { x, y, w, h } = this.tempRect;
		if (w < 0) {
			x += w;
			w = Math.abs(w);
		}
		if (h < 0) {
			y += h;
			h = Math.abs(h);
		}
		if (w > 10 && h > 10) {
			this.polygons = [
				...this.polygons,
				{
					id: this.nextPolygonId++,
					points: [
						{ x, y },
						{ x: x + w, y },
						{ x: x + w, y: y + h },
						{ x, y: y + h }
					]
				}
			];
		}
		this.isDrawing = false;
		this.tempRect = null;
	}

	deletePolygon(id: number) {
		this.polygons = this.polygons.filter((p) => p.id !== id);
	}

	clearMask() {
		this.rects = [];
		this.paths = [];
		this.polygons = [];
		this.aiMaskUrl = null;
		this.assetUrl = null;
		this.tempRect = null;
		this.tempPath = null;
		this.tempPoly = null;
		this.isDrawing = false;
	}

	setAiMask(url: string) {
		this.aiMaskUrl = url;
		this.maskTool = 'magic';
	}

	clear() {
		this.prompt = '';
		this.clearMask();
	}
}
