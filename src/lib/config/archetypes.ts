export interface DimensionScores {
	focus: number;
	energy: number;
	scale: number;
	formality: number;
	craft: number;
}

export interface Archetype {
	name: string;
	description: string;
	key: string; // slug for DB storage
}

// Each quest step maps choice a/b to dimension adjustments
// Index matches quest step index (0-4)
export const DIMENSION_WEIGHTS: { a: Partial<DimensionScores>; b: Partial<DimensionScores> }[] = [
	// Step 1: Workstation
	{ a: { focus: -1, energy: 1, formality: -1 }, b: { focus: 1, energy: -1, formality: 1 } },
	// Step 2: Meeting
	{ a: { scale: -1, formality: -1, energy: -1 }, b: { scale: 1, formality: 1, energy: 1 } },
	// Step 3: Focus
	{ a: { focus: 1, scale: -1, craft: 1 }, b: { focus: 1, scale: -1, craft: -1 } },
	// Step 4: Social
	{ a: { energy: 1, formality: -1, craft: 1 }, b: { energy: -1, formality: -1, craft: -1 } },
	// Step 5: Privacy
	{ a: { focus: -1, energy: 1, scale: 1 }, b: { focus: 1, energy: -1, scale: -1 } }
];

export const ARCHETYPES: Archetype[] = [
	{
		key: 'architect',
		name: 'The Architect',
		description:
			'You build spaces that think. Every surface has purpose, every corner is intentional.'
	},
	{
		key: 'collaborator',
		name: 'The Collaborator',
		description: 'Your workspace is alive with conversation. Walls come down, ideas flow free.'
	},
	{
		key: 'minimalist',
		name: 'The Minimalist',
		description: 'Less is more. Silence is your greatest tool, space is your canvas.'
	},
	{
		key: 'curator',
		name: 'The Curator',
		description: 'Details matter. Every object is chosen, every texture considered.'
	},
	{
		key: 'connector',
		name: 'The Connector',
		description: 'Barriers? What barriers? Your workspace brings people together naturally.'
	},
	{
		key: 'strategist',
		name: 'The Strategist',
		description: 'Command rooms and war tables. You see the big picture and design for it.'
	},
	{
		key: 'creator',
		name: 'The Creator',
		description: 'Your workspace is a studio. Energy, inspiration, and craft converge.'
	},
	{
		key: 'explorer',
		name: 'The Explorer',
		description: 'You defy categories. Your workspace is as dynamic and multifaceted as you are.'
	}
];

// Archetype matching rules: [dimensionKey, sign (+1 or -1)][]
const ARCHETYPE_RULES: Record<string, [keyof DimensionScores, number][]> = {
	architect: [
		['focus', 1],
		['formality', 1]
	],
	collaborator: [
		['focus', -1],
		['energy', 1]
	],
	minimalist: [
		['focus', 1],
		['energy', -1]
	],
	curator: [
		['craft', 1],
		['formality', 1]
	],
	connector: [
		['focus', -1],
		['formality', -1]
	],
	strategist: [
		['focus', 1],
		['scale', 1]
	],
	creator: [
		['craft', 1],
		['energy', 1]
	],
	explorer: [] // fallback
};

export function computeArchetype(choices: ('a' | 'b')[]): Archetype {
	const scores: DimensionScores = { focus: 0, energy: 0, scale: 0, formality: 0, craft: 0 };

	for (let i = 0; i < choices.length && i < DIMENSION_WEIGHTS.length; i++) {
		const weights = DIMENSION_WEIGHTS[i][choices[i]];
		for (const [dim, val] of Object.entries(weights)) {
			scores[dim as keyof DimensionScores] += val as number;
		}
	}

	// Find best matching archetype (highest score against rules)
	let bestKey = 'explorer';
	let bestScore = -Infinity;

	for (const [key, rules] of Object.entries(ARCHETYPE_RULES)) {
		if (rules.length === 0) continue;
		let score = 0;
		for (const [dim, sign] of rules) {
			score += scores[dim] * sign;
		}
		if (score > bestScore) {
			bestScore = score;
			bestKey = key;
		}
	}

	// Fallback to explorer if no strong signal
	if (bestScore <= 0) bestKey = 'explorer';

	return ARCHETYPES.find((a) => a.key === bestKey) ?? ARCHETYPES[ARCHETYPES.length - 1];
}
