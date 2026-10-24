export const NODES = ['A','B','C','D','E','F','G','H','I'] as const;
export type Node = typeof NODES[number];
export const COORDINATES: Record<Node, readonly [number, number]> = {
  A:[100,100], B:[300,100], C:[500,100],
  D:[100,300], E:[300,300], F:[500,300],
  G:[100,500], H:[300,500], I:[500,500],
};
export const EDGES: readonly (readonly [Node,Node])[] = [
  ['A','B'],['B','C'],['D','E'],['E','F'],['G','H'],['H','I'],
  ['A','D'],['D','G'],['B','E'],['E','H'],['C','F'],['F','I'],
  ['A','E'],['E','I'],['C','E'],['E','G'],
];
export const ADJACENCY = Object.fromEntries(NODES.map(node => [node, EDGES.flatMap(([a,b])=>a===node?[b]:b===node?[a]:[])])) as Record<Node,Node[]>;
