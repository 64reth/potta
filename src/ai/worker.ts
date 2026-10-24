import { chooseAction } from "./search";
self.onmessage = (event) => {
  try {
    self.postMessage({
      action: chooseAction(
        event.data.state,
        event.data.difficulty,
        event.data.seed,
      ).action,
    });
  } catch {
    self.postMessage({ error: "The computer paused. Try this turn again." });
  }
};
