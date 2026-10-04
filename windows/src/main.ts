// Entry point: boot the bridge, wire the island, start the greeting.

import "./style.css";
import { Bridge, IS_TAURI, onEvent } from "./core/bridge";
import { Sound } from "./core/sound";
import { State, type Settings } from "./core/state";
import { Island } from "./island/island";
import { registerHookHandlers } from "./island/hooks";
import { registerIntegrationHandlers, refreshConfigured } from "./island/integrations";

window.addEventListener("error", (e) => {
  void Bridge.log(`JS_ERROR: ${e.message} at ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack}` : String(e.reason);
  void Bridge.log(`JS_PROMISE_REJECTION: ${reason}`);
});

async function main() {
  await Bridge.log("STEP 1: main() started");
  try {
    const root = document.getElementById("root");
    if (!root) {
      await Bridge.log("ERROR: root element not found!");
      return;
    }
    await Bridge.log("STEP 2: root element found");

    void Sound.preload();
    await Bridge.log("STEP 3: Sound.preload initiated");

    await Bridge.log("STEP 4: Creating Island instance...");
    const island = new Island(root);
    await Bridge.log("STEP 5: Island instantiated successfully");

    await Bridge.log("STEP 6: Calling Bridge.boot()...");
    const boot = await Bridge.boot();
    await Bridge.log(`STEP 7: Bridge.boot returned: ${boot ? "success" : "null"}`);

    if (boot) {
      State.settings = { ...State.settings, ...boot.settings };
    }
    island.applySettings();
    await Bridge.log("STEP 8: applySettings done");
    State.loadIntegrationTasks();
    await Bridge.log("STEP 9: loadIntegrationTasks done");
    if (boot && !boot.cursorPoll) island.followPageCursor();

    await onEvent<{ x: number; y: number }>("cursor", ({ x, y }) => island.onCursor(x, y));
    await Bridge.log("STEP 10: onEvent cursor registered");

  /** Pause has to reach Rust too, or the pollers keep calling out. */
  const setPaused = (on: boolean) => {
    if (State.paused === on) return;
    State.paused = on;
    void Bridge.setPaused(on);
  };

  await onEvent<string>("tray", (what) => {
    switch (what) {
      case "settings":
        setPaused(false);
        island.alert("settings");
        break;
      case "open":
        setPaused(false);
        island.wake();
        island.expand(State.defaultView());
        Sound.play("open");
        break;
      case "pause":
        setPaused(!State.paused);
        if (State.paused) island.fsm.forceHidden();
        else island.reveal();
        break;
    }
  });

  await onEvent("wake", () => {
    setPaused(false);
    void Bridge.log("frontend: received wake event -> expanding island to home");
    island.wake();
    island.expand(State.defaultView());
    Sound.play("open");
  });


  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      island.collapse();
    }
  });

  await onEvent<null>("screen-changed", () => void Bridge.reposition());

  // The settings window writes preferences; apply them here without a restart.
  await onEvent<Settings>("settings-changed", (s) => {
    State.settings = { ...State.settings, ...s };
    island.applySettings();
    State.loadIntegrationTasks();
    void refreshConfigured();
  });

  await Bridge.log("STEP 11: Registering hooks & integrations");
  registerHookHandlers(island);
  registerIntegrationHandlers(island);

  await Bridge.log("STEP 12: Calling island.launch()");
  island.launch();
  await Bridge.log("STEP 13: island.launch() completed!");

  // In a plain browser there is no wake strip behind the cursor: make the whole
  // page wake the island so the visuals can be checked with `npm run dev`.
  if (!IS_TAURI) {
    document.addEventListener("click", () => Sound.resume(), { once: true });
  }
  } catch (err: any) {
    await Bridge.log(`CRASH_IN_MAIN: ${err?.stack || err?.message || String(err)}`);
  }
}

void main();
