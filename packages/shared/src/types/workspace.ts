export interface MaskRect {
	id: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface MaskPath {
	id: number;
	points: { x: number; y: number }[];
	strokeWidth: number;
}

export type MaskPolygon = {
	id: number;
	points: { x: number; y: number }[];
};

export interface MaskData {
	rects: MaskRect[];
	paths: MaskPath[];
	polygons: MaskPolygon[];
	tool: 'draw' | 'magic' | 'brush' | 'poly';
	aiMaskUrl: string | null;
	assetUrl: string | null;
}

export interface Version {
	id: string;
	step: number;
	parentId: string | null;
	imageUrl: string;
	prompt: string;
	createdAt: string;
}

export interface TreeNode extends Version {
	children: TreeNode[];
	versionLabel: string;
}
