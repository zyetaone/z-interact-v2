import { describe, it, expect } from 'vitest';
import { BLOCKED_TERMS, MAX_FIELD_LENGTH } from './edit-prompt';

describe('BLOCKED_TERMS', () => {
	it('contains expected blocked terms', () => {
		expect(BLOCKED_TERMS).toContain('nude');
		expect(BLOCKED_TERMS).toContain('weapon');
		expect(BLOCKED_TERMS).toContain('nsfw');
		expect(BLOCKED_TERMS).toContain('kill');
	});

	it('all terms are lowercase strings', () => {
		for (const term of BLOCKED_TERMS) {
			expect(typeof term).toBe('string');
			expect(term).toBe(term.toLowerCase());
		}
	});

	it('has no duplicates', () => {
		const unique = new Set(BLOCKED_TERMS);
		expect(unique.size).toBe(BLOCKED_TERMS.length);
	});

	it('blocks case-insensitive matches when used correctly', () => {
		const prompt = 'Add a WEAPON to the desk';
		const isBlocked = BLOCKED_TERMS.some((term) => prompt.toLowerCase().includes(term));
		expect(isBlocked).toBe(true);
	});

	it('does not block clean prompts', () => {
		const prompt = 'Add a modern standing desk with plants';
		const isBlocked = BLOCKED_TERMS.some((term) => prompt.toLowerCase().includes(term));
		expect(isBlocked).toBe(false);
	});
});

describe('MAX_FIELD_LENGTH', () => {
	it('is a positive number', () => {
		expect(MAX_FIELD_LENGTH).toBeGreaterThan(0);
	});

	it('is 200 characters', () => {
		expect(MAX_FIELD_LENGTH).toBe(200);
	});
});
