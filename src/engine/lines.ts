import type { Node } from './geometry';
export const WINNING_LINES: readonly (readonly Node[])[] = [
  ['A','B','C'],['D','E','F'],['G','H','I'],
  ['A','D','G'],['B','E','H'],['C','F','I'],['A','E','I'],['C','E','G'],
];
