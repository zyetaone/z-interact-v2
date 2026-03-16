export interface IslandModel {
	id: string;
	name: string;
	imageUrl: string;
	modelUrl?: string | null;
	editCount: number;
	sortOrder?: number;
}

export interface SceneControls {
	resetView: () => void;
	toggleAvatar: () => boolean;
}

export type ViewMode = 'overview' | 'diving' | 'dived' | 'returning';

export interface BuildingControls {
	resetView: () => void;
	focusRoom: (roomId: string) => void;
}
