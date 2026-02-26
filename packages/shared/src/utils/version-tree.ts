import type { Version, TreeNode } from '../types/workspace';

export function buildTree(items: Version[]): TreeNode[] {
	const nodeMap = new Map<string, TreeNode>();
	for (const item of items) {
		const { id, step, parentId, imageUrl, prompt, createdAt } = item;
		nodeMap.set(id, {
			id,
			step,
			parentId,
			imageUrl,
			prompt,
			createdAt,
			children: [],
			versionLabel: ''
		});
	}

	const roots: TreeNode[] = [];
	const nodes = Array.from(nodeMap.values());

	for (const node of nodes) {
		if (!node.parentId) {
			roots.push(node);
		} else {
			const parent = nodeMap.get(node.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				roots.push(node); // Orphan fallback
			}
		}
	}

	// Sort children by step
	for (const node of nodes) {
		node.children.sort((a, b) => a.step - b.step);
	}

	roots.sort((a, b) => a.step - b.step);

	// Calculate Semantic Versions (1.1, 1.2.1, etc)
	function setLabels(nodes: TreeNode[], prefix: string) {
		nodes.forEach((node, index) => {
			const label = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
			node.versionLabel = label;
			setLabels(node.children, label);
		});
	}
	setLabels(roots, '');

	return roots;
}

export function isLeafNode(nodeId: string, items: Version[]): boolean {
	return !items.some((r) => r.parentId === nodeId);
}

export function getAncestryPath(nodeId: string | null, items: Version[]): Version[] {
	if (!nodeId) return [];
	const map = new Map(items.map((i) => [i.id, i]));
	const path: Version[] = [];
	const visited = new Set<string>();

	let current: string | null = nodeId;
	while (current) {
		if (visited.has(current)) break;
		visited.add(current);
		const node = map.get(current);
		if (!node) break;
		path.unshift(node);
		current = node.parentId;
	}
	return path;
}

/** Alias for getAncestryPath */
export const getPathToNode = getAncestryPath;
