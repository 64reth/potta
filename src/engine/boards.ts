import { NODES, EDGES, ADJACENCY, COORDINATES, type Node } from "./geometry";
import { WINNING_LINES } from "./lines";
export type BoardSize = 3 | 4 | 5;
export interface BoardGeometry {
  size: BoardSize;
  name: string;
  pieces: number;
  target: number;
  nodes: readonly Node[];
  edges: readonly (readonly [Node, Node])[];
  adjacency: Record<Node, Node[]>;
  coordinates: Record<Node, readonly [number, number]>;
  lines: readonly (readonly Node[])[];
  centres: Node[];
}
// Modern variant targets can be tuned here without changing transitions or rendering.
export const BOARD_RULES = {
  3: { pieces: 3, target: 3 },
  4: { pieces: 4, target: 4 },
  5: { pieces: 5, target: 5 },
} as const;
const cache = new Map<BoardSize, BoardGeometry>();
export function boardGeometry(size: BoardSize = 3): BoardGeometry {
  const hit = cache.get(size);
  if (hit) return hit;
  if (![3, 4, 5].includes(size)) throw Error("Unsupported board size");
  if (size === 3) {
    const board: BoardGeometry = {
      size,
      name: "Traditional",
      pieces: BOARD_RULES[3].pieces,
      target: BOARD_RULES[3].target,
      nodes: NODES,
      edges: EDGES,
      adjacency: ADJACENCY,
      coordinates: COORDINATES as BoardGeometry["coordinates"],
      lines: WINNING_LINES,
      centres: ["E"],
    };
    cache.set(size, board);
    return board;
  }
  const nodes = Array.from(
      { length: size * size },
      (_, i) => String.fromCharCode(65 + i) as Node,
    ),
    edges: [Node, Node][] = [];
  const at = (row: number, col: number) => nodes[row * size + col];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      if (c + 1 < size) edges.push([at(r, c), at(r, c + 1)]);
      if (r + 1 < size) edges.push([at(r, c), at(r + 1, c)]);
    }
  for (let i = 0; i < size - 1; i++) {
    edges.push([at(i, i), at(i + 1, i + 1)]);
    edges.push([at(i, size - 1 - i), at(i + 1, size - 2 - i)]);
  }
  const lines: Node[][] = [];
  for (let i = 0; i < size; i++) {
    lines.push(Array.from({ length: size }, (_, j) => at(i, j)));
    lines.push(Array.from({ length: size }, (_, j) => at(j, i)));
  }
  lines.push(
    Array.from({ length: size }, (_, i) => at(i, i)),
    Array.from({ length: size }, (_, i) => at(i, size - 1 - i)),
  );
  const coordinates = Object.fromEntries(
    nodes.map((n, i) => [
      n,
      [
        100 + (400 * (i % size)) / (size - 1),
        100 + (400 * Math.floor(i / size)) / (size - 1),
      ],
    ]),
  ) as BoardGeometry["coordinates"];
  const adjacency = Object.fromEntries(
    nodes.map((n) => [
      n,
      edges.flatMap(([a, b]) => (a === n ? [b] : b === n ? [a] : [])),
    ]),
  ) as BoardGeometry["adjacency"];
  const middle = size % 2 ? [Math.floor(size / 2)] : [size / 2 - 1, size / 2];
  const centres = middle.flatMap((r) => middle.map((c) => at(r, c)));
  const { pieces, target } = BOARD_RULES[size];
  const segments = lines.flatMap((line) =>
    Array.from({ length: line.length - target + 1 }, (_, i) =>
      line.slice(i, i + target),
    ),
  );
  const board: BoardGeometry = {
    size,
    name: size === 4 ? "Four" : "Five",
    pieces,
    target,
    nodes,
    edges,
    adjacency,
    coordinates,
    lines: segments,
    centres,
  };
  cache.set(size, board);
  return board;
}
