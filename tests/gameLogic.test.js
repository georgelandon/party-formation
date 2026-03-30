import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialState,
  getFormationLayout,
  resolveObstacleEffect,
  updateGame,
} from "../gameLogic.js";

test("phalanx prioritizes tanks in the front row", () => {
  const state = createInitialState();
  const layout = getFormationLayout(state.player.party, "phalanx");
  assert.equal(layout[0].type, "square");
  assert.equal(layout[0].isFront, true);
});

test("column packs units into a single narrow lane", () => {
  const state = createInitialState();
  const layout = getFormationLayout(state.player.party, "column");
  assert.ok(layout.every((unit) => unit.x === 0));
  assert.equal(layout.filter((unit) => unit.isFront).length, 1);
});

test("narrow gap only passes in column formation", () => {
  const frontUnits = [{ type: "square" }];
  const fail = resolveObstacleEffect({ type: "narrow-gap" }, "phalanx", frontUnits);
  const pass = resolveObstacleEffect({ type: "narrow-gap" }, "column", frontUnits);
  assert.equal(fail.passed, false);
  assert.equal(pass.passed, true);
});

test("breakable barrier requires triangles in the front row", () => {
  const fail = resolveObstacleEffect({ type: "breakable-barrier" }, "phalanx", [{ type: "square" }]);
  const pass = resolveObstacleEffect({ type: "breakable-barrier" }, "spearhead", [{ type: "triangle" }]);
  assert.equal(fail.passed, false);
  assert.equal(pass.passed, true);
});

test("game ends when the party is emptied", () => {
  const state = createInitialState();
  state.player.party = [];
  const next = updateGame(state, { moveX: 0, cycleFormation: false, prevFormation: false }, 1 / 60);
  assert.equal(next.gameOver, true);
  assert.equal(next.running, false);
});
