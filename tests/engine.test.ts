import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ADJACENCY,EDGES,NODES,type Node} from '../src/engine/geometry';
import {WINNING_LINES} from '../src/engine/lines';
import {initialState,transition,legalActions,DEFAULT_RULES,potta,type State,type Action} from '../src/engine/game';
import {GameSession,replay} from '../src/engine/session';
const opening:Node[]=['A','B','D','E','I','G'];
function placed(nodes=opening){let s=initialState();for(const to of nodes)s=transition(s,{type:'place',to}).state;return s;}
test('exact graph: 16 symmetric consecutive edges and eight lines',()=>{
 assert.equal(EDGES.length,16);assert.equal(WINNING_LINES.length,8);assert.equal(ADJACENCY.E.length,8);assert.deepEqual(ADJACENCY.A,['B','D','E']);
 for(const [a,b] of EDGES)assert.ok(ADJACENCY[b].includes(a));
});
test('placement alternates, prevents overlaps, immutability and switches at six',()=>{
 const s=initialState(),next=transition(s,{type:'place',to:'A'}).state;
 assert.equal(s.board.A,null);assert.equal(next.turn,'gold');assert.throws(()=>transition(next,{type:'place',to:'A'}));
 assert.throws(()=>transition(next,{type:'place',to:'B'},'blue'));assert.equal(placed().phase,'movement');assert.equal(placed().turn,'blue');
});
test('placement victory is explicitly configurable including sixth placement',()=>{
 const nodes:Node[]=['A','D','B','E','C'];
 let s=initialState();for(const to of nodes)s=transition(s,{type:'place',to}).state;assert.equal(s.result.status,'playing');
 s=initialState({...DEFAULT_RULES,placementWins:true});for(const to of nodes)s=transition(s,{type:'place',to}).state;assert.equal(s.result.status,'won');assert.equal(legalActions(s).length,0);
 let sixth=initialState({...DEFAULT_RULES,placementWins:true});for(const to of ['A','D','B','E','I','F'] as Node[])sixth=transition(sixth,{type:'place',to}).state;assert.equal(sixth.result.status,'won');
});
test('movement rejects jumps, occupied destinations, opponent pieces and placement actions',()=>{
 const s=placed();assert.throws(()=>transition(s,{type:'move',from:'A',to:'C'}));assert.throws(()=>transition(s,{type:'move',from:'A',to:'E'}));assert.throws(()=>transition(s,{type:'move',from:'B',to:'C'}));assert.throws(()=>transition(s,{type:'place',to:'C'}));
 const next=transition(s,{type:'move',from:'I',to:'F'}).state;assert.equal(next.board.I,null);assert.equal(next.board.F,'blue');assert.equal(next.turn,'gold');
});
test('all eight winning lines detected in movement',()=>{
 for(const line of WINNING_LINES){
  // Find a legal predecessor with two aligned pieces and a third adjacent to the missing point.
  let found=false;
  for(const to of line)for(const from of ADJACENCY[to].filter(n=>!line.includes(n))){
   const s=initialState();s.phase='movement';s.placed={blue:3,gold:3};
   for(const n of line)if(n!==to)s.board[n]='blue';s.board[from]='blue';
   NODES.filter(n=>!s.board[n]&&n!==to).slice(0,3).forEach(n=>s.board[n]='gold');
   const result=transition(s,{type:'move',from,to}).state.result;
   assert.equal(result.status,'won');if(result.status==='won')assert.equal(result.winner,'blue');found=true;break;
  }assert.ok(found);
 }
});
test('repetition includes side to play; movement limit configurable',()=>{
 let s=placed();const cycle:Action[]=[{type:'move',from:'I',to:'H'},{type:'move',from:'E',to:'F'},{type:'move',from:'H',to:'I'},{type:'move',from:'F',to:'E'}];
 for(let i=0;i<8;i++)s=transition(s,cycle[i%4]).state;assert.deepEqual(s.result,{status:'draw',reason:'Position repeated'});
 s=placed();s.rules={...DEFAULT_RULES,repetition:null,moveLimit:2};for(const a of cycle.slice(0,2))s=transition(s,a).state;assert.deepEqual(s.result,{status:'draw',reason:'Movement limit reached'});
 s=placed();s.rules={...DEFAULT_RULES,repetition:null,moveLimit:null};for(let i=0;i<12;i++)s=transition(s,cycle[i%4]).state;assert.equal(s.result.status,'playing');
});
test('blocked opening handles configurable draw, loss and pass',()=>{
 for(const blocked of ['draw','loss','pass'] as const){
  let s=initialState({...DEFAULT_RULES,blocked});
  for(const to of ['A','C','B','E','D','G'] as Node[])s=transition(s,{type:'place',to}).state;
  if(blocked==='draw')assert.deepEqual(s.result,{status:'draw',reason:'No available move'});
  if(blocked==='loss'){assert.equal(s.result.status,'won');if(s.result.status==='won')assert.equal(s.result.winner,'gold');}
  if(blocked==='pass'){assert.equal(s.result.status,'playing');assert.equal(s.turn,'gold');assert.ok(legalActions(s).length);}
 }
});
test('session snapshots detached, rejected actions leave recording intact and replay exact',()=>{
 const game=new GameSession(potta,DEFAULT_RULES,[{id:'blue',name:'Azure'},{id:'gold',name:'Ochre'}]);
 for(const to of opening)game.dispatch(game.state.turn,{type:'place',to});const before=game.export();assert.throws(()=>game.dispatch('blue',{type:'move',from:'A',to:'C'}));assert.equal(game.export(),before);
 game.dispatch('blue',{type:'move',from:'I',to:'F'});const snapshot=game.state;snapshot.board.A=null;assert.equal(game.state.board.A,'blue');
 assert.deepEqual(replay(potta,game.recording).state,game.state);const broken=game.recording;broken.actions[0].events=[];assert.throws(()=>replay(potta,broken));
});
