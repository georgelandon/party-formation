import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialState,
  createUnit,
  getFormationLayout,
  resolveObstacleEffect,
  updateGame,
} from "../gameLogic.js";

test("phalanx prioritizes tanks in the front row", () => {
  const party = [createUnit("circle", "unit-3"), createUnit("square", "unit-1"), createUnit("triangle", "unit-2")];
  const layout = getFormationLayout(party, "phalanx");
  assert.equal(layout[0].type, "square");
  assert.equal(layout[0].isFront, true);
});

test("column packs units into a single narrow lane", () => {
  const party = [createUnit("circle", "unit-1"), createUnit("triangle", "unit-2"), createUnit("square", "unit-3")];
  const layout = getFormationLayout(party, "column");
  assert.ok(layout.every((unit) => unit.x === 0));
  assert.equal(layout.filter((unit) => unit.isFront).length, 1);
});

test("game starts with one circle and two formations", () => {
  const state = createInitialState();
  assert.equal(state.player.party.length, 1);
  assert.equal(state.player.party[0].type, "circle");
  assert.deepEqual(state.player.availableFormations, ["spread", "column"]);

  const firstPickup = [...state.level.pickups].sort((a, b) => a.y - b.y)[0];
  const firstObstacle = [...state.level.obstacles].sort((a, b) => a.y - b.y)[0];
  assert.equal(firstPickup.type, "triangle");
  assert.equal(firstObstacle.type, "narrow-gap");
  assert.ok(firstObstacle.y < firstPickup.y);
});

test("spread fires a wider ranged volley than column", () => {
  const spreadState = createInitialState();
  spreadState.level.pickups = [];
  spreadState.level.obstacles = [];
  spreadState.level.enemies = [{ id: "enemy-1", x: 316, y: 180, hp: 1, speed: 0 }];
  spreadState.level.nextPickupY = 999999;
  spreadState.level.nextEnemyY = 999999;
  spreadState.level.nextObstacleY = 999999;

  const spreadNext = updateGame(spreadState, { moveX: 0, cycleFormation: false, prevFormation: false }, 1 / 60);
  assert.equal(spreadNext.projectiles.length, 3);
  assert.ok(spreadNext.projectiles.some((projectile) => projectile.x < spreadNext.player.x));
  assert.ok(spreadNext.projectiles.some((projectile) => projectile.x > spreadNext.player.x));

  const columnState = createInitialState();
  columnState.player.formation = "column";
  columnState.level.pickups = [];
  columnState.level.obstacles = [];
  columnState.level.enemies = [{ id: "enemy-1", x: 316, y: 180, hp: 1, speed: 0 }];
  columnState.level.nextPickupY = 999999;
  columnState.level.nextEnemyY = 999999;
  columnState.level.nextObstacleY = 999999;

  const columnNext = updateGame(columnState, { moveX: 0, cycleFormation: false, prevFormation: false }, 1 / 60);
  assert.equal(columnNext.projectiles.length, 0);
});

test("narrow gap only passes in column formation", () => {
  const frontUnits = [{ type: "circle" }];
  const fail = resolveObstacleEffect({ type: "narrow-gap" }, "spread", frontUnits);
  const pass = resolveObstacleEffect({ type: "narrow-gap" }, "column", frontUnits);
  assert.equal(fail.passed, false);
  assert.equal(pass.passed, true);
});

test("breakable barrier requires triangles in the front row", () => {
  const fail = resolveObstacleEffect({ type: "breakable-barrier" }, "spread", [{ type: "circle" }]);
  const pass = resolveObstacleEffect({ type: "breakable-barrier" }, "spearhead", [{ type: "triangle" }]);
  assert.equal(fail.passed, false);
  assert.equal(pass.passed, true);
});

test("triangle pickup unlocks spearhead and adds a second unit", () => {
  const state = createInitialState();
  state.level.pickups = [{ id: "pickup-1", type: "triangle", x: state.player.x, y: 0 }];
  state.level.obstacles = [];
  state.level.enemies = [];
  state.level.nextPickupY = 999999;
  state.level.nextEnemyY = 999999;
  state.level.nextObstacleY = 999999;

  const next = updateGame(state, { moveX: 0, cycleFormation: false, prevFormation: false }, 0);
  assert.equal(next.player.party.length, 2);
  assert.ok(next.player.availableFormations.includes("spearhead"));
  assert.match(next.message, /Spearhead unlocked/i);
});

test("game ends when the party is emptied", () => {
  const state = createInitialState();
  state.player.party = [];
  const next = updateGame(state, { moveX: 0, cycleFormation: false, prevFormation: false }, 1 / 60);
  assert.equal(next.gameOver, true);
  assert.equal(next.running, false);
});

test("content replenishes ahead of the player for endless runs", () => {
  const state = createInitialState();
  state.distance = 12000;
  state.level.pickups = [];
  state.level.obstacles = [];
  state.level.enemies = [];

  const next = updateGame(state, { moveX: 0, cycleFormation: false, prevFormation: false }, 0);

  assert.ok(next.level.pickups.some((pickup) => pickup.y > next.distance));
  assert.ok(next.level.obstacles.some((obstacle) => obstacle.y > next.distance));
  assert.ok(next.level.enemies.some((enemy) => enemy.y > next.distance));
});
