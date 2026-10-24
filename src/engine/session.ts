export interface Player { id: string; name: string }
export type Outcome = { status: 'playing' } | { status: 'won'; winners: string[]; reason: string } | { status: 'draw'; reason: string };
export interface GameEvent { type: string; message: string }
/** Lobby management with detached snapshots. Session rosters are fixed once play begins. */
export interface PlayerManagement {
  readonly players: Player[];
  add(player: Player): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
}
export class PlayerRoster implements PlayerManagement {
  private entries: Player[] = [];
  get players(): Player[] { return structuredClone(this.entries); }
  add(player: Player): void {
    if (!player.id || !player.name.trim() || this.entries.some(p => p.id === player.id)) throw Error('Player needs a unique ID and non-empty name');
    this.entries.push(structuredClone(player));
  }
  rename(id: string, name: string): void {
    const player = this.entries.find(p => p.id === id);
    if (!player || !name.trim()) throw Error('Unknown player or empty name');
    player.name = name.trim();
  }
  remove(id: string): void {
    if (!this.entries.some(p => p.id === id)) throw Error('Unknown player');
    this.entries = this.entries.filter(p => p.id !== id);
  }
}
export interface Random { next(): number; int(max: number): number }
export interface GameDefinition<S, A, C> {
  id: string; version: number;
  validateConfig(config: C, players: Player[]): void;
  initialise(config: C, players: Player[], random: Random): S;
  legalActions(state: S, playerId: string): A[];
  transition(state: S, action: A, playerId: string, random: Random): { state: S; events: GameEvent[] };
  outcome(state: S): Outcome;
}
export interface ActionRecord<A> { playerId: string; action: A; events: GameEvent[] }
export interface Recording<A, C> { format: 1; game: string; version: number; seed: number; config: C; players: Player[]; actions: ActionRecord<A>[] }
export function seededRandom(seed: number): Random {
  let value = seed >>> 0;
  const next = () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return { next, int(max) { if (!Number.isSafeInteger(max) || max < 1) throw Error('Random bound must be a positive integer'); return Math.floor(next() * max); } };
}
export class GameSession<S, A, C> {
  private tape: Recording<A, C>;
  get recording(): Recording<A, C> { return structuredClone(this.tape); }
  private current: S;
  private random: Random;
  get state(): S { return structuredClone(this.current); }
  constructor(readonly game: GameDefinition<S, A, C>, config: C, players: Player[], seed = 1) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Seed must be a uint32');
    if (!players.length || players.some(p => !p.id || !p.name.trim()) || new Set(players.map(p => p.id)).size !== players.length) throw Error('Players need unique IDs and names');
    game.validateConfig(config, players);
    this.random = seededRandom(seed);
    this.tape = structuredClone({ format: 1, game: game.id, version: game.version, seed, config, players, actions: [] });
    this.current = game.initialise(structuredClone(config), structuredClone(players), this.random);
  }
  dispatch(playerId: string, action: A): S {
    if (this.game.outcome(this.state).status !== 'playing') throw Error('Game has ended');
    if (!this.tape.players.some(p => p.id === playerId)) throw Error('Unknown player');
    const legal = this.game.legalActions(this.state, playerId);
    if (!legal.some(a => JSON.stringify(a) === JSON.stringify(action))) throw Error('Illegal action');
    // Rebuild RNG on rejection so even a throwing adapter cannot poison the next action.
    try {
      const result = this.game.transition(this.state, structuredClone(action), playerId, this.random);
      this.current = structuredClone(result.state);
      this.tape.actions.push(structuredClone({ playerId, action, events: result.events }));
    } catch (error) {
      const recovered = replay(this.game, this.tape); this.random = recovered.random; throw error;
    }
    return this.state;
  }
  export(): string { return JSON.stringify(this.tape, null, 2); }
}
export function replay<S, A, C>(game: GameDefinition<S, A, C>, recording: Recording<A, C>, steps = recording.actions?.length): GameSession<S, A, C> {
  if (recording.format !== 1 || recording.game !== game.id || recording.version !== game.version || !Array.isArray(recording.actions) || recording.actions.length > 10000) throw Error('Unsupported recording');
  if (!Number.isInteger(steps) || steps < 0 || steps > recording.actions.length) throw Error('Invalid replay position');
  const session = new GameSession(game, recording.config, recording.players, recording.seed);
  for (const entry of recording.actions.slice(0, steps)) {
    session.dispatch(entry.playerId, entry.action);
    if (JSON.stringify(session.recording.actions.at(-1)?.events) !== JSON.stringify(entry.events)) throw Error('Replay events differ; check game version');
  }
  return session;
}
