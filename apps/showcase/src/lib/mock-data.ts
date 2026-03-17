/**
 * Mock data for showcase engine demos.
 * Uses local workspace images from static/assets/.
 */

// -- World Engine ----------------------------------------------------------

export interface IslandModel {
	id: string;
	name: string;
	imageUrl: string;
	modelUrl?: string | null;
	editCount: number;
	sortOrder?: number;
}

export const MOCK_ISLANDS: IslandModel[] = [
	{
		id: 'island-1',
		name: 'Open Desk',
		imageUrl: '/assets/WS 01.jpg',
		editCount: 5,
		sortOrder: 0
	},
	{
		id: 'island-2',
		name: 'Small Huddle',
		imageUrl: '/assets/4 PAX.jpg',
		editCount: 3,
		sortOrder: 1
	},
	{
		id: 'island-3',
		name: 'Focus Room',
		imageUrl: '/assets/FOCUS RM 01.jpg',
		editCount: 7,
		sortOrder: 2
	},
	{
		id: 'island-4',
		name: 'Lounge',
		imageUrl: '/assets/LOUNGE 01.jpg',
		editCount: 2,
		sortOrder: 3
	},
	{
		id: 'island-5',
		name: 'Quiet Pod',
		imageUrl: '/assets/FOCUS RM 02.jpg',
		editCount: 4,
		sortOrder: 4
	}
];

// -- Video Engine ----------------------------------------------------------

export interface ImageItem {
	id: string;
	url: string;
	name: string;
}

export const MOCK_IMAGES: ImageItem[] = [
	{ id: 'v1', url: '/assets/WS 01.jpg', name: 'Open Desk' },
	{ id: 'v2', url: '/assets/WS 02.jpg', name: 'Structured Desk' },
	{ id: 'v3', url: '/assets/4 PAX.jpg', name: 'Small Huddle' },
	{ id: 'v4', url: '/assets/PROJECT ROOM 01.jpg', name: 'Project Room' },
	{ id: 'v5', url: '/assets/LOUNGE 01.jpg', name: 'Lounge' },
	{ id: 'v6', url: '/assets/BOOTH.jpg', name: 'Phone Booth' }
];

// -- Editor Engine ---------------------------------------------------------

export const MOCK_EDITOR_IMAGE = '/assets/WS 01.jpg';
