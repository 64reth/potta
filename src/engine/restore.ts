import { potta, legacyPotta, type Rules, type Action } from "./game";
import { replay, type Recording } from "./session";
export const restoreGame = (recording: Recording<Action, Rules>) =>
  replay(recording.version === 1 ? legacyPotta : potta, recording);
