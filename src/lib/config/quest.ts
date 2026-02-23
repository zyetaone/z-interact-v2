export interface QuestStep {
	id: number;
	category: string;
	prompt: string;
	optionA: { image: string; name: string; tags: string[] };
	optionB: { image: string; name: string; tags: string[] };
}

export const QUEST_STEPS: QuestStep[] = [
	{
		id: 1,
		category: 'Workstation',
		prompt: 'Which workstation style inspires your best work?',
		optionA: {
			image: '/assets/WS 01.jpg',
			name: 'Open Desk',
			tags: ['open-plan', 'collaborative', 'flexible']
		},
		optionB: {
			image: '/assets/WS 02.jpg',
			name: 'Structured Desk',
			tags: ['organized', 'individual', 'focused']
		}
	},
	{
		id: 2,
		category: 'Meeting',
		prompt: 'How do you prefer to meet with your team?',
		optionA: {
			image: '/assets/4 PAX.jpg',
			name: 'Small Huddle',
			tags: ['intimate', 'agile', 'quick-sync']
		},
		optionB: {
			image: '/assets/PROJECT ROOM 01.jpg',
			name: 'Project Room',
			tags: ['workshop', 'brainstorm', 'presentation']
		}
	},
	{
		id: 3,
		category: 'Focus',
		prompt: 'Where do you go when you need deep concentration?',
		optionA: {
			image: '/assets/FOCUS RM 01.jpg',
			name: 'Focus Room',
			tags: ['quiet', 'private', 'deep-work']
		},
		optionB: {
			image: '/assets/BOOTH.jpg',
			name: 'Phone Booth',
			tags: ['compact', 'call-ready', 'enclosed']
		}
	},
	{
		id: 4,
		category: 'Social',
		prompt: 'What kind of social space energizes you?',
		optionA: {
			image: '/assets/LOUNGE 01.jpg',
			name: 'Lounge',
			tags: ['relaxed', 'casual', 'social']
		},
		optionB: {
			image: '/assets/PANTRY.jpg',
			name: 'Pantry',
			tags: ['kitchen', 'communal', 'break-area']
		}
	},
	{
		id: 5,
		category: 'Collaboration',
		prompt: 'How does your team tackle big challenges?',
		optionA: {
			image: '/assets/PROJECT ROOM 02.jpg',
			name: 'War Room',
			tags: ['strategy', 'whiteboard', 'immersive']
		},
		optionB: {
			image: '/assets/TRAINING RM.jpg',
			name: 'Training Room',
			tags: ['learning', 'lecture', 'scalable']
		}
	},
	{
		id: 6,
		category: 'Privacy',
		prompt: 'What does your ideal retreat look like?',
		optionA: {
			image: '/assets/OP LOUNGE 01.jpg',
			name: 'Open Lounge',
			tags: ['semi-private', 'lounge', 'transition']
		},
		optionB: {
			image: '/assets/FOCUS RM 02.jpg',
			name: 'Quiet Pod',
			tags: ['enclosed', 'soundproof', 'sanctuary']
		}
	},
	{
		id: 7,
		category: 'Kitchen',
		prompt: 'What fuels your workday?',
		optionA: {
			image: '/assets/OP MK PANTRY.jpg',
			name: 'Maker Kitchen',
			tags: ['barista', 'premium', 'craft']
		},
		optionB: {
			image: '/assets/HYDRATION.jpg',
			name: 'Hydration Station',
			tags: ['minimal', 'quick', 'grab-and-go']
		}
	}
];
