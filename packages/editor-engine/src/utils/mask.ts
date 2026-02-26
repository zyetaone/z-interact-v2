import type { MaskRect, MaskPath, MaskPolygon } from '@zyeta/shared/types';

export function generateMaskFromShapes(
	rects: MaskRect[],
	paths: MaskPath[],
	polygons: MaskPolygon[],
	naturalWidth: number,
	naturalHeight: number,
	renderedFrame: { x: number; y: number; width: number; height: number; scale: number }
): string | undefined {
	if (!rects.length && !paths.length && !polygons.length) return;

	const offscreen = document.createElement('canvas');
	offscreen.width = naturalWidth;
	offscreen.height = naturalHeight;
	const ctx = offscreen.getContext('2d');
	if (!ctx) return;

	// Fill with black (masked area)
	ctx.fillStyle = 'black';
	ctx.fillRect(0, 0, offscreen.width, offscreen.height);

	const { x: ox, y: oy, scale } = renderedFrame;

	// Draw white rectangles (unmasked area)
	ctx.fillStyle = 'white';
	for (const rect of rects) {
		ctx.fillRect((rect.x - ox) * scale, (rect.y - oy) * scale, rect.w * scale, rect.h * scale);
	}

	// Draw white paths (brush strokes)
	ctx.strokeStyle = 'white';
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (const path of paths) {
		if (path.points.length < 2) continue;
		ctx.lineWidth = path.strokeWidth * scale;
		ctx.beginPath();
		ctx.moveTo((path.points[0].x - ox) * scale, (path.points[0].y - oy) * scale);
		for (let i = 1; i < path.points.length; i++) {
			ctx.lineTo((path.points[i].x - ox) * scale, (path.points[i].y - oy) * scale);
		}
		ctx.stroke();
	}

	// Draw white polygons (quads)
	ctx.fillStyle = 'white';
	for (const poly of polygons) {
		if (poly.points.length < 3) continue;
		ctx.beginPath();
		ctx.moveTo((poly.points[0].x - ox) * scale, (poly.points[0].y - oy) * scale);
		for (let i = 1; i < poly.points.length; i++) {
			ctx.lineTo((poly.points[i].x - ox) * scale, (poly.points[i].y - oy) * scale);
		}
		ctx.closePath();
		ctx.fill();
	}

	return offscreen.toDataURL('image/png');
}
