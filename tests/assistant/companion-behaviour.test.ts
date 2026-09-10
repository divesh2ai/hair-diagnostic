import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AssistantCompanionStateMachine } from "@/components/assistant/AssistantCompanion";

// The companion sits at z-60 over a clinical workspace. Everything asserted
// here is about it NOT interfering: it starts parked, it only ever moves when
// dragged, and its actions respond to the first click.

const SOURCE = readFileSync(
  join(process.cwd(), "apps/patient-portal/src/components/assistant/AssistantCompanion.tsx"),
  "utf8",
);

const { initialState, transition } = AssistantCompanionStateMachine;

describe("companion — flying is the default, the pin is the off switch", () => {
  it("starts free, so it flies to the doctor's clicks without being asked", () => {
    expect(initialState.pinned).toBe(false);
  });

  it("starts perched and visible rather than mid-animation", () => {
    expect(initialState.state).toBe("idle-perched");
    expect(initialState.minimized).toBe(false);
  });

  it("toggles park on and off, and nothing else", () => {
    const parked = transition(initialState, { type: "TOGGLE_PIN" });
    expect(parked.pinned).toBe(true);
    expect(parked.state).toBe(initialState.state);
    expect(parked.minimized).toBe(initialState.minimized);

    expect(transition(parked, { type: "TOGGLE_PIN" }).pinned).toBe(false);
  });

  it("keeps the park preference across a minimize / restore round trip", () => {
    const parked = transition(initialState, { type: "TOGGLE_PIN" });
    const minimized = transition(parked, { type: "MINIMIZE" });
    const restored = transition(minimized, { type: "RESTORE" });
    expect(minimized.pinned).toBe(true);
    expect(restored.pinned).toBe(true);
  });

  it("persists the choice, so parking it once is enough", () => {
    expect(SOURCE).toContain('window.localStorage.setItem("drfact-companion-preferences"');
    expect(SOURCE).toContain("pinned: snapshot.pinned");
    expect(SOURCE).toContain('if (typeof preferences.pinned === "boolean")');
  });
});

describe("companion — click-to-travel, and the pin that stops it", () => {
  const listener = SOURCE.slice(
    SOURCE.indexOf("const handlePointerDestination"),
    SOURCE.indexOf('window.addEventListener("pointerdown", handlePointerDestination'),
  );

  it("flies to the pointer — the behaviour the doctor asked to keep", () => {
    expect(listener).toMatch(/flyTo\(clampToViewport\(/);
  });

  it("is not even attached while parked", () => {
    // The pin is a real off switch, not a branch inside the handler: parked,
    // the listener is never registered, so a parked companion cannot be moved
    // by any click, however the handler later changes.
    const effect = SOURCE.slice(
      SOURCE.indexOf("// \u2500\u2500 Click-to-travel"),
      SOURCE.indexOf("const handlePointerDestination"),
    );
    expect(effect).toMatch(/if \(pinned\) return;/);
  });

  it("never treats a click on a control as a destination", () => {
    // Pressing Approve, opening a menu, focusing a field or following a link
    // must move nothing.
    expect(listener).toContain("target.closest(IGNORE_FLIGHT_TARGETS)");
    const ignore = SOURCE.slice(
      SOURCE.indexOf("const IGNORE_FLIGHT_TARGETS"),
      SOURCE.indexOf("function companionDimensions"),
    );
    for (const control of [
      "button",
      "input",
      "textarea",
      "select",
      "label",
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[contenteditable="true"]',
      "[data-companion-ignore-pointer]",
    ]) {
      expect(ignore).toContain(control);
    }
  });

  it("only flies from a settled state, and never mid-drag", () => {
    expect(listener).toMatch(/state !== "idle-perched"/);
    expect(listener).toMatch(/draggingRef\.current/);
    expect(listener).toMatch(/event\.button !== 0/);
  });

  it("stays off the one route where it could cover a clinical decision", () => {
    // The case-review page carries the sticky decision bar. A mascot at z-60
    // over Approve is not a thing that may happen, flying or parked.
    expect(SOURCE).toContain("const COMPANION_EXCLUDED");
    expect(SOURCE).toContain("/^\\/doctor\\/reports\\/[^/]+/");
  });

  it("leaves the wake-from-sleep listener alone, and it still moves nothing", () => {
    const body = SOURCE.slice(
      SOURCE.indexOf("const markActivity"),
      SOURCE.indexOf("const markActivity") + 260,
    );
    expect(body).not.toMatch(/setPosition|manualPositionRef|clampToViewport/);
  });
});

describe("companion — its actions are the first click, not the second", () => {
  it("does not take pointer capture on pointerdown", () => {
    // Capturing on pointerdown retargets the pointerup to the drag layer, so
    // the browser resolves the click against the layer instead of the button
    // that was pressed — which is why Notes and Coffee appeared dead. Capture
    // belongs in pointermove, once a drag threshold is genuinely crossed.
    const downAt = SOURCE.indexOf("onPointerDown={(event) => {");
    const moveAt = SOURCE.indexOf("onPointerMove={(event) => {");
    const upAt = SOURCE.indexOf("onPointerUp={() => finishLead(false)}");
    expect(downAt).toBeGreaterThan(-1);
    expect(moveAt).toBeGreaterThan(downAt);
    expect(upAt).toBeGreaterThan(moveAt);

    // Match the CALL, not the word — the pointerdown block carries a comment
    // explaining why the call is absent, and that comment must not fail this.
    const CALL = /\.setPointerCapture(?:\?\.)?\(/;
    expect(SOURCE.slice(downAt, moveAt)).not.toMatch(CALL);
    expect(SOURCE.slice(moveAt, upAt)).toMatch(CALL);
  });

  it("treats a failed pointer capture as survivable, not fatal", () => {
    // setPointerCapture throws NotFoundError once the pointer id is no longer
    // active, and `?.` does not help — the method exists, the call fails.
    // Unguarded, that exception aborts the rest of the move handler and the
    // drag is left half-started. Capture is an enhancement; losing it must not
    // cost the drag.
    const moveAt = SOURCE.indexOf("onPointerMove={(event) => {");
    const upAt = SOURCE.indexOf("onPointerUp={() => finishLead(false)}");
    const move = SOURCE.slice(moveAt, upAt);
    expect(move).toMatch(/try \{[\s\S]*setPointerCapture\(event\.pointerId\);[\s\S]*\} catch \{/);
  });

  it("suppresses the click only after a real drag, and resets on cancel", () => {
    expect(SOURCE).toMatch(/onClickCapture=\{\(event\) => \{\s*if \(!didDragRef\.current\) return;/);
    expect(SOURCE).toMatch(/onPointerCancel=\{\(\) => \{[\s\S]*didDragRef\.current = false;/);
  });

  it("plays an action synchronously — no animation-frame hop", () => {
    // requestAnimationFrame never runs in a backgrounded tab, which was one
    // more way for these buttons to look broken.
    const from = SOURCE.indexOf("const playPreview");
    expect(from).toBeGreaterThan(-1);
    const play = SOURCE.slice(from, SOURCE.indexOf("}, [companion]);", from));
    // The comment names requestAnimationFrame; the CODE must not call it.
    expect(play).not.toMatch(/(?:window\.)?requestAnimationFrame\s*\(/);
    expect(play).toContain('companion.state === next ? "idle-perched" : next');
  });
});

describe("companion — placement never animates in from the corner", () => {
  it("defers movement initialisation until a real anchor is resolved", () => {
    // The pre-placement position is a shared constant whose identity marks
    // "not yet measured", so the first real anchor teleports instead of
    // gliding diagonally across the whole viewport on every page load.
    expect(SOURCE).toContain("const UNPLACED: ResolvedAnchor");
    expect(SOURCE).toContain("if (position !== UNPLACED) initializedRef.current = true;");
  });

  it("refuses to place against a zero-sized viewport", () => {
    expect(SOURCE).toContain("if (!window.innerWidth || !window.innerHeight) return;");
  });
});

describe("companion — reduced motion", () => {
  it("honours the OS preference as well as the in-app toggle", () => {
    expect(SOURCE).toContain("useReducedMotion");
    expect(SOURCE).toContain("systemReducedMotion || companion.motionReduced");
  });

  it("stops every companion animation under prefers-reduced-motion", () => {
    const css = readFileSync(
      join(
        process.cwd(),
        "apps/patient-portal/src/components/assistant/AssistantCompanion.module.css",
      ),
      "utf8",
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.mover, \.companion, \.prop, \.prop \* \{ animation: none !important; transition: none !important; \}/,
    );
  });
});
