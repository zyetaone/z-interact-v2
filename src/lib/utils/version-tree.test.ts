import { describe, it, expect } from 'vitest';
import { buildTree, isLeafNode, getAncestryPath, getPathToNode } from './version-tree';
import type { Version } from '$lib/types/workspace';

function v(id: string, step: number, parentId: string | null = null): Version {
	return { id, step, parentId, imageUrl: `/img/${id}`, prompt: `prompt-${id}`, createdAt: '' };
}

describe('buildTree', () => {
	it('returns empty array for empty input', () => {
		expect(buildTree([])).toEqual([]);
	});

	it('builds a single root node', () => {
		const tree = buildTree([v('a', 1)]);
		expect(tree).toHaveLength(1);
		expect(tree[0].id).toBe('a');
		expect(tree[0].children).toEqual([]);
		expect(tree[0].versionLabel).toBe('1');
	});

	it('builds a linear chain', () => {
		const tree = buildTree([v('a', 1), v('b', 2, 'a'), v('c', 3, 'b')]);

		expect(tree).toHaveLength(1);
		expect(tree[0].id).toBe('a');
		expect(tree[0].versionLabel).toBe('1');

		expect(tree[0].children).toHaveLength(1);
		expect(tree[0].children[0].id).toBe('b');
		expect(tree[0].children[0].versionLabel).toBe('1.1');

		expect(tree[0].children[0].children).toHaveLength(1);
		expect(tree[0].children[0].children[0].id).toBe('c');
		expect(tree[0].children[0].children[0].versionLabel).toBe('1.1.1');
	});

	it('builds a branching tree', () => {
		const tree = buildTree([
			v('root', 1),
			v('left', 2, 'root'),
			v('right', 3, 'root'),
			v('left-child', 4, 'left')
		]);

		expect(tree).toHaveLength(1);
		const root = tree[0];
		expect(root.children).toHaveLength(2);

		expect(root.children[0].id).toBe('left');
		expect(root.children[0].versionLabel).toBe('1.1');
		expect(root.children[1].id).toBe('right');
		expect(root.children[1].versionLabel).toBe('1.2');

		expect(root.children[0].children).toHaveLength(1);
		expect(root.children[0].children[0].id).toBe('left-child');
		expect(root.children[0].children[0].versionLabel).toBe('1.1.1');
	});

	it('sorts children by step', () => {
		// Insert in reverse step order
		const tree = buildTree([v('root', 1), v('c', 5, 'root'), v('a', 3, 'root'), v('b', 4, 'root')]);

		expect(tree[0].children.map((c) => c.id)).toEqual(['a', 'b', 'c']);
	});

	it('handles multiple roots', () => {
		const tree = buildTree([v('a', 1), v('b', 2)]);
		expect(tree).toHaveLength(2);
		expect(tree[0].versionLabel).toBe('1');
		expect(tree[1].versionLabel).toBe('2');
	});

	it('treats orphaned nodes (missing parent) as roots', () => {
		const tree = buildTree([v('a', 1, 'nonexistent'), v('b', 2)]);
		expect(tree).toHaveLength(2);
	});
});

describe('isLeafNode', () => {
	const items = [v('a', 1), v('b', 2, 'a'), v('c', 3, 'b')];

	it('returns true for leaf nodes', () => {
		expect(isLeafNode('c', items)).toBe(true);
	});

	it('returns false for nodes with children', () => {
		expect(isLeafNode('a', items)).toBe(false);
		expect(isLeafNode('b', items)).toBe(false);
	});

	it('returns true for nonexistent node id', () => {
		expect(isLeafNode('nonexistent', items)).toBe(true);
	});
});

describe('getAncestryPath', () => {
	const items = [v('a', 1), v('b', 2, 'a'), v('c', 3, 'b'), v('d', 4, 'a')];

	it('returns empty array for null nodeId', () => {
		expect(getAncestryPath(null, items)).toEqual([]);
	});

	it('returns single node for root', () => {
		const path = getAncestryPath('a', items);
		expect(path.map((n) => n.id)).toEqual(['a']);
	});

	it('returns full path from root to target', () => {
		const path = getAncestryPath('c', items);
		expect(path.map((n) => n.id)).toEqual(['a', 'b', 'c']);
	});

	it('returns correct branch path', () => {
		const path = getAncestryPath('d', items);
		expect(path.map((n) => n.id)).toEqual(['a', 'd']);
	});

	it('handles nonexistent nodeId', () => {
		expect(getAncestryPath('nonexistent', items)).toEqual([]);
	});

	it('handles circular references without infinite loop', () => {
		const circular = [v('a', 1, 'b'), v('b', 2, 'a')];
		const path = getAncestryPath('a', circular);
		// Should terminate (visited set prevents infinite loop)
		expect(path.length).toBeLessThanOrEqual(2);
	});
});

describe('getPathToNode', () => {
	it('is an alias for getAncestryPath', () => {
		expect(getPathToNode).toBe(getAncestryPath);
	});
});
