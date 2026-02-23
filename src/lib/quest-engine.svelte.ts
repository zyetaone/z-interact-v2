import { QUEST_STEPS, type QuestStep } from '$lib/config/quest';

export interface QuestResult {
	stepId: number;
	spaceName: string;
	imageUrl: string;
	tags: string[];
}

export class QuestEngine {
	currentStep = $state(0);
	choices = $state<('a' | 'b')[]>([]);

	readonly isComplete = $derived(this.choices.length >= QUEST_STEPS.length);
	readonly step: QuestStep | undefined = $derived(QUEST_STEPS[this.currentStep]);
	readonly progress = $derived(this.choices.length / QUEST_STEPS.length);

	get results(): QuestResult[] {
		return this.choices.map((choice, i) => {
			const step = QUEST_STEPS[i];
			const option = choice === 'a' ? step.optionA : step.optionB;
			return {
				stepId: step.id,
				spaceName: option.name,
				imageUrl: option.image,
				tags: option.tags
			};
		});
	}

	choose(option: 'a' | 'b') {
		this.choices = [...this.choices, option];
		this.currentStep = this.choices.length;
	}

	reset() {
		this.currentStep = 0;
		this.choices = [];
	}
}
