import type { Editor } from '../editor.svelte';
import type { MaskRect, MaskPath, MaskPolygon } from '@zyeta/shared/types';

type Params = {
	editor: Editor;
	width: number;
	height: number;
	naturalWidth: number;
	naturalHeight: number;
	renderedFrame: { x: number; y: number; width: number; height: number; scale: number };
	onMagicClick?: (x: number, y: number) => void;
};

type AttachmentParams = {
	editor: Editor;
	width: number;
	height: number;
	naturalWidth: number;
	naturalHeight: number;
	aiMaskImage?: HTMLImageElement | null;
};

const HANDLE_RADIUS = 8;
const DELETE_RADIUS = 12;

function hitTestRect(x: number, y: number, rects: MaskRect[]) {
	return rects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

function hitTestDelete(x: number, y: number, rects: MaskRect[]) {
	for (const r of rects) {
		const dx = x - (r.x + r.w);
		const dy = y - r.y;
		if (Math.sqrt(dx * dx + dy * dy) < DELETE_RADIUS) return r.id;
	}
	return null;
}

function hitTestPolygonVertex(x: number, y: number, polygons: MaskPolygon[]) {
	for (const poly of polygons) {
		for (let i = 0; i < poly.points.length; i++) {
			const p = poly.points[i];
			const dx = x - p.x;
			const dy = y - p.y;
			if (Math.sqrt(dx * dx + dy * dy) < HANDLE_RADIUS * 1.5) {
				return { polyId: poly.id, vertexIdx: i };
			}
		}
	}
	return null;
}

function drawPolygon(
	ctx: CanvasRenderingContext2D,
	poly: MaskPolygon,
	color: string,
	showHandles: boolean
) {
	if (poly.points.length < 2) return;

	ctx.fillStyle = color;
	ctx.strokeStyle = '#a855f7';
	ctx.lineWidth = 2;

	ctx.beginPath();
	ctx.moveTo(poly.points[0].x, poly.points[0].y);
	for (let i = 1; i < poly.points.length; i++) {
		ctx.lineTo(poly.points[i].x, poly.points[i].y);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	if (showHandles) {
		ctx.fillStyle = 'white';
		ctx.strokeStyle = '#a855f7';
		ctx.lineWidth = 2;
		for (const p of poly.points) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}
}

function drawCanvas(
	ctx: CanvasRenderingContext2D,
	params: AttachmentParams,
	tempRect: MaskRect | null,
	tempPath: MaskPath | null,
	tempPoly: MaskPolygon | null
) {
	const { width, height } = params;
	ctx.clearRect(0, 0, width, height);

	// Draw AI Mask if present
	if (params.aiMaskImage) {
		ctx.save();
		ctx.globalAlpha = 0.4;
		ctx.drawImage(params.aiMaskImage, 0, 0, width, height);
		ctx.restore();
	}

	// Draw existing rects
	for (const rect of params.editor.rects) {
		ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
		ctx.strokeStyle = '#a855f7';
		ctx.lineWidth = 2;
		ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
		ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

		// Delete button (X)
		ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
		ctx.beginPath();
		ctx.arc(rect.x + rect.w, rect.y, 10, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'white';
		ctx.font = 'bold 12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('X', rect.x + rect.w, rect.y);
	}

	// Draw existing paths
	for (const path of params.editor.paths) {
		if (path.points.length < 2) continue;
		ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
		ctx.lineWidth = path.strokeWidth;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(path.points[0].x, path.points[0].y);
		for (let i = 1; i < path.points.length; i++) {
			ctx.lineTo(path.points[i].x, path.points[i].y);
		}
		ctx.stroke();
	}

	// Draw existing polygons
	for (const poly of params.editor.polygons) {
		drawPolygon(ctx, poly, 'rgba(168, 85, 247, 0.4)', params.editor.maskTool === 'poly');
	}

	// Draw temporary shapes
	if (tempRect) {
		ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
		ctx.strokeStyle = '#a855f7';
		ctx.setLineDash([5, 5]);
		ctx.strokeRect(tempRect.x, tempRect.y, tempRect.w, tempRect.h);
		ctx.setLineDash([]);
	}

	if (tempPath && tempPath.points.length > 1) {
		ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
		ctx.lineWidth = tempPath.strokeWidth;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(tempPath.points[0].x, tempPath.points[0].y);
		for (let i = 1; i < tempPath.points.length; i++) {
			ctx.lineTo(tempPath.points[i].x, tempPath.points[i].y);
		}
		ctx.stroke();
	}

	if (tempPoly) {
		drawPolygon(ctx, tempPoly, 'rgba(168, 85, 247, 0.2)', true);
	}
}

function getCoords(e: MouseEvent | TouchEvent, rect: DOMRect) {
	if ('touches' in e) {
		const touch = e.touches[0] || e.changedTouches[0];
		return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
	}
	return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export function maskCanvas(node: HTMLCanvasElement, getParams: () => Params) {
	const ctx = node.getContext('2d');
	if (!ctx) return;

	let loadedAiMaskImage: HTMLImageElement | null = null;

	function getAttachmentParams(): AttachmentParams {
		const p = getParams();
		return {
			editor: p.editor,
			width: p.width,
			height: p.height,
			naturalWidth: p.naturalWidth,
			naturalHeight: p.naturalHeight,
			aiMaskImage: loadedAiMaskImage
		};
	}

	function redraw(
		tempRect: MaskRect | null = null,
		tempPath: MaskPath | null = null,
		tempPoly: MaskPolygon | null = null
	) {
		if (!ctx) return;
		drawCanvas(ctx, getAttachmentParams(), tempRect, tempPath, tempPoly);
	}

	// Load AI mask image when URL changes
	$effect(() => {
		const p = getParams();
		const url = p.editor.aiMaskUrl;
		if (url !== undefined && url !== (loadedAiMaskImage?.src ?? null)) {
			if (!url) {
				loadedAiMaskImage = null;
				redraw();
				return;
			}
			const img = new Image();
			img.onload = () => {
				loadedAiMaskImage = img;
				redraw();
			};
			img.onerror = () => {
				loadedAiMaskImage = null;
			};
			img.src = url;
		}
	});

	// Reactive drawing effect — also tracks canvas dimensions for resize
	$effect(() => {
		const p = getAttachmentParams();
		// Tracking dependencies
		void p.width;
		void p.height;
		void p.editor.rects;
		void p.editor.paths;
		void p.editor.polygons;
		void p.editor.tempRect;
		void p.editor.tempPath;
		void p.editor.tempPoly;
		redraw(p.editor.tempRect, p.editor.tempPath, p.editor.tempPoly);
	});

	// State for dragging
	let dragRectId: number | null = null;
	let dragPolyId: number | null = null;
	let dragVertexIdx: number | null = null;
	let dragOffset = { x: 0, y: 0 };

	function handleStart(e: MouseEvent | TouchEvent) {
		const p = getParams();
		if (!p.width || !p.height) return;

		const rect = node.getBoundingClientRect();
		const { x, y } = getCoords(e, rect);
		const frame = p.renderedFrame;
		if (!frame) return;

		// Check if within image bounds
		if (x < frame.x || x > frame.x + frame.width || y < frame.y || y > frame.y + frame.height) {
			return;
		}

		if (p.editor.maskTool === 'magic' && p.onMagicClick) {
			const imageX = (x - frame.x) * frame.scale;
			const imageY = (y - frame.y) * frame.scale;
			p.onMagicClick(imageX, imageY);
			return;
		}

		// Check delete button hit
		const delId = hitTestDelete(x, y, p.editor.rects);
		if (delId !== null) {
			p.editor.deleteRect(delId);
			return;
		}

		// Check poly vertex hit (high priority for poly tool)
		if (p.editor.maskTool === 'poly') {
			const hit = hitTestPolygonVertex(x, y, p.editor.polygons);
			if (hit) {
				dragPolyId = hit.polyId;
				dragVertexIdx = hit.vertexIdx;
				return;
			}
		}

		// Check rect hit for dragging
		const hit = hitTestRect(x, y, p.editor.rects);
		if (hit && p.editor.maskTool === 'draw') {
			dragRectId = hit.id;
			dragOffset = { x: x - hit.x, y: y - hit.y };
			return;
		}

		// Start drawing
		if (p.editor.maskTool === 'brush') {
			p.editor.startBrushStroke(x, y);
		} else {
			// Both 'draw' and 'poly' start as rect drawing
			p.editor.startDrawing(x, y);
		}
	}

	function handleMove(e: MouseEvent | TouchEvent) {
		const p = getParams();
		if (!p.width || !p.height) return;

		const rect = node.getBoundingClientRect();
		const { x, y } = getCoords(e, rect);
		const frame = p.renderedFrame;
		if (!frame) return;

		// Constrain coordinates to image frame
		const cx = Math.max(frame.x, Math.min(frame.x + frame.width, x));
		const cy = Math.max(frame.y, Math.min(frame.y + frame.height, y));

		// Handle poly vertex dragging
		if (dragPolyId !== null && dragVertexIdx !== null && p.editor.maskTool === 'poly') {
			p.editor.updatePolygonVertex(dragPolyId, dragVertexIdx, cx, cy);
			return;
		}

		// Handle rect dragging
		if (dragRectId !== null && p.editor.maskTool === 'draw') {
			const idx = p.editor.rects.findIndex((r) => r.id === dragRectId);
			if (idx !== -1) {
				const r = p.editor.rects[idx];
				const newX = Math.max(frame.x, Math.min(frame.x + frame.width - r.w, x - dragOffset.x));
				const newY = Math.max(frame.y, Math.min(frame.y + frame.height - r.h, y - dragOffset.y));
				p.editor.updateRect(idx, { x: newX, y: newY });
			}
			return;
		}

		if (!p.editor.isDrawing) return;

		if (p.editor.maskTool === 'brush') {
			p.editor.continueBrushStroke(cx, cy);
		} else if (p.editor.tempRect) {
			p.editor.updateDrawing(cx, cy);
			redraw(p.editor.tempRect);
		}
	}

	function handleEnd() {
		const p = getParams();

		if (dragRectId !== null || dragPolyId !== null) {
			dragRectId = null;
			dragPolyId = null;
			dragVertexIdx = null;
			return;
		}

		if (!p.editor.isDrawing) return;

		if (p.editor.maskTool === 'brush') {
			p.editor.finishBrushStroke();
		} else if (p.editor.maskTool === 'poly') {
			p.editor.finishDrawingAsPoly();
		} else {
			p.editor.finishDrawing();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			const p = getParams();
			p.editor.isDrawing = false;
			p.editor.tempRect = null;
			p.editor.tempPath = null;
			dragRectId = null;
			redraw();
		}
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		const p = getParams();
		const rect = node.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const hit = hitTestRect(x, y, p.editor.rects);
		if (hit) {
			p.editor.deleteRect(hit.id);
		}
	}

	// Attach events
	node.addEventListener('mousedown', handleStart);
	node.addEventListener('touchstart', handleStart);
	node.addEventListener('mousemove', handleMove);
	node.addEventListener('touchmove', handleMove);
	node.addEventListener('mouseup', handleEnd);
	node.addEventListener('touchend', handleEnd);
	node.addEventListener('mouseleave', handleEnd);
	node.addEventListener('keydown', handleKeyDown);
	node.addEventListener('contextmenu', handleContextMenu);

	// Initial draw
	redraw();

	return {
		destroy() {
			node.removeEventListener('mousedown', handleStart);
			node.removeEventListener('touchstart', handleStart);
			node.removeEventListener('mousemove', handleMove);
			node.removeEventListener('touchmove', handleMove);
			node.removeEventListener('mouseup', handleEnd);
			node.removeEventListener('touchend', handleEnd);
			node.removeEventListener('mouseleave', handleEnd);
			node.removeEventListener('keydown', handleKeyDown);
			node.removeEventListener('contextmenu', handleContextMenu);
		}
	};
}
