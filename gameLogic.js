export const FORMATIONS = ["spread", "column", "spearhead", "phalanx"];
export const UNIT_TYPES = ["square", "triangle", "circle"];

const PLAYER_BOUNDS = { minX: 60, maxX: 360 };
const UNIT_HP = { square: 3, triangle: 2, circle: 1 };
const UNIT_ROLE = { square: "tank", triangle: "melee", circle: "ranged" };
const UNIT_COLOR = { square: "#8bd3dd", triangle: "#ffd166", circle: "#ff7f7f" };
const FORMATION_LABEL = {
  spread: "Spread",
  column: "Column",
  spearhead: "Spearhead",
  phalanx: "Phalanx",
};

const STARTING_FORMATIONS = ["spread", "column"];
const LANE_X = [104, 158, 210, 262, 316];
const SPAWN_BUFFER = 3200;
const OBSTACLE_SEQUENCE = ["damage-wall", "breakable-barrier", "narrow-gap", "projectile-field"];
const OBSTACLE_CONFIG = {
  "damage-wall": { width: 190 },
  "breakable-barrier": { width: 180 },
  "narrow-gap": { width: 80 },
  "projectile-field": { width: 220, length: 180 },
};

const INTRO_PICKUPS = [{ type: "triangle", x: 210, y: 1480 }];
const INTRO_ENEMIES = [
  { x: 126, y: 290, hp: 1, speed: 18 },
  { x: 294, y: 320, hp: 1, speed: 18 },
  { x: 210, y: 700, hp: 2, speed: 24 },
  { x: 210, y: 1720, hp: 2, speed: 28 },
];
const INTRO_OBSTACLES = [
  { type: "narrow-gap", x: 210, y: 980 },
  { type: "breakable-barrier", x: 210, y: 2240 },
];

export function createUnit(type, id) {
  return {
    id,
    type,
    role: UNIT_ROLE[type],
    hp: UNIT_HP[type],
    maxHp: UNIT_HP[type],
    cooldown: 0,
  };
}

function nextRandom(state) {
  state.rngSeed = (Math.imul(state.rngSeed, 1664525) + 1013904223) >>> 0;
  return state.rngSeed / 0x100000000;
}

function pickRandom(state, values) {
  return values[Math.floor(nextRandom(state) * values.length)];
}

function createPickupEntity(state, type, x, y) {
  const pickup = {
    id: `pickup-${state.nextPickupId}`,
    type,
    x,
    y,
  };
  state.nextPickupId += 1;
  return pickup;
}

function createEnemyEntity(state, x, y, hp, speed) {
  const enemy = {
    id: `enemy-${state.nextEnemyId}`,
    x,
    y,
    hp,
    speed,
  };
  state.nextEnemyId += 1;
  return enemy;
}

function createObstacleEntity(state, type, y, x = 210) {
  const config = OBSTACLE_CONFIG[type];
  const obstacle = {
    id: `obs-${state.nextObstacleId}`,
    type,
    x,
    y,
    width: config.width,
    resolved: false,
    timer: 0,
  };
  if (config.length) {
    obstacle.length = config.length;
  }
  state.nextObstacleId += 1;
  return obstacle;
}

function choosePickupType(state) {
  const counts = { square: 0, triangle: 0, circle: 0 };
  for (const unit of state.player.party) {
    counts[unit.type] += 1;
  }

  const underrepresented = UNIT_TYPES.reduce((best, type) => {
    if (counts[type] < counts[best]) {
      return type;
    }
    return best;
  }, UNIT_TYPES[0]);

  if (nextRandom(state) < 0.6) {
    return underrepresented;
  }
  return pickRandom(state, UNIT_TYPES);
}

function chooseLaneX(state, avoidX = null) {
  let lane = pickRandom(state, LANE_X);
  if (avoidX !== null && LANE_X.length > 1 && lane === avoidX) {
    lane = LANE_X[(LANE_X.indexOf(lane) + 1 + Math.floor(nextRandom(state) * (LANE_X.length - 1))) % LANE_X.length];
  }
  return lane;
}

function setMessage(state, text) {
  state.message = text;
}

function unlockFormation(state, formation) {
  if (state.player.availableFormations.includes(formation)) {
    return false;
  }
  state.player.availableFormations = FORMATIONS.filter(
    (name) => name === formation || state.player.availableFormations.includes(name),
  );
  return true;
}

function maybeUnlockFormationForUnit(state, unitType) {
  if (unitType === "triangle" && unlockFormation(state, "spearhead")) {
    return "spearhead";
  }
  if (unitType === "square" && unlockFormation(state, "phalanx")) {
    return "phalanx";
  }
  return null;
}

function seedInitialContent(state) {
  for (const pickup of INTRO_PICKUPS) {
    state.level.pickups.push(createPickupEntity(state, pickup.type, pickup.x, pickup.y));
  }

  for (const enemy of INTRO_ENEMIES) {
    state.level.enemies.push(createEnemyEntity(state, enemy.x, enemy.y, enemy.hp, enemy.speed));
  }

  for (const obstacle of INTRO_OBSTACLES) {
    state.level.obstacles.push(createObstacleEntity(state, obstacle.type, obstacle.y, obstacle.x));
  }

  state.level.nextPickupY = 2840;
  state.level.nextEnemyY = 1980;
  state.level.nextObstacleY = 3380;
  state.level.obstaclePatternIndex = 0;
  maintainSpawnBuffers(state);
}

export function createInitialState() {
  const state = {
    running: true,
    gameOver: false,
    score: 0,
    kills: 0,
    nextUnitId: 2,
    nextProjectileId: 1,
    nextPickupId: 1,
    nextObstacleId: 1,
    nextEnemyId: 1,
    rngSeed: 0x1234abcd,
    distance: 0,
    player: {
      x: 210,
      speed: 125,
      moveSpeed: 215,
      formation: "spread",
      availableFormations: [...STARTING_FORMATIONS],
      party: [createUnit("circle", "unit-1")],
    },
    level: {
      pickups: [],
      obstacles: [],
      enemies: [],
      nextPickupY: 0,
      nextEnemyY: 0,
      nextObstacleY: 0,
      obstaclePatternIndex: 0,
    },
    projectiles: [],
    tutorial: {
      step: 1,
    },
    message: "Solo circle: Spread hits wide lanes.",
  };

  seedInitialContent(state);
  return state;
}

function priorityByFormation(formation) {
  switch (formation) {
    case "phalanx":
      return { square: 0, triangle: 1, circle: 2 };
    case "spearhead":
      return { triangle: 0, square: 1, circle: 2 };
    case "spread":
      return { circle: 0, triangle: 1, square: 2 };
    case "column":
      return { square: 0, triangle: 1, circle: 2 };
    default:
      return { square: 0, triangle: 1, circle: 2 };
  }
}

export function getFormationLayout(party, formation) {
  const priority = priorityByFormation(formation);
  const sorted = [...party].sort((a, b) => {
    const diff = priority[a.type] - priority[b.type];
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  if (formation === "column") {
    return sorted.map((unit, index) => ({
      ...unit,
      x: 0,
      y: -42 + index * 24,
      row: index === 0 ? "front" : "back",
      isFront: index === 0,
    }));
  }

  if (formation === "spread") {
    const spacing = party.length > 1 ? 120 / (party.length - 1) : 0;
    return sorted.map((unit, index) => ({
      ...unit,
      x: party.length === 1 ? 0 : -60 + spacing * index,
      y: priority[unit.type] === 0 ? -48 : -10,
      row: priority[unit.type] === 0 ? "front" : "back",
      isFront: priority[unit.type] === 0,
    }));
  }

  const frontCount = Math.max(1, Math.min(3, Math.ceil(sorted.length / 2)));
  return sorted.map((unit, index) => {
    const isFront = index < frontCount;
    const rowIndex = isFront ? index : index - frontCount;
    const lane = isFront ? frontCount : Math.max(1, sorted.length - frontCount);
    const spacing = lane === 1 ? 0 : 70 / (lane - 1);
    return {
      ...unit,
      x: lane === 1 ? 0 : -35 + spacing * rowIndex,
      y: isFront ? -44 : 2 + rowIndex * 4,
      row: isFront ? "front" : "back",
      isFront,
    };
  });
}

export function cycleFormation(formation, direction = 1, formations = FORMATIONS) {
  const index = formations.indexOf(formation);
  const baseIndex = index === -1 ? 0 : index;
  const nextIndex = (baseIndex + direction + formations.length) % formations.length;
  return formations[nextIndex];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyDamageToUnit(unit, amount) {
  return { ...unit, hp: unit.hp - amount };
}

function getFrontUnits(party, formation) {
  return getFormationLayout(party, formation).filter((unit) => unit.isFront);
}

function replacePartyUnits(state, mutatedUnits) {
  const byId = new Map(mutatedUnits.map((unit) => [unit.id, unit]));
  state.player.party = state.player.party
    .map((unit) => byId.get(unit.id) || unit)
    .filter((unit) => unit.hp > 0);
}

function damageFrontUnits(state, amount, count = 1) {
  const frontUnits = getFrontUnits(state.player.party, state.player.formation);
  if (frontUnits.length === 0) {
    state.player.party = [];
    return;
  }

  const updated = [];
  for (let index = 0; index < Math.min(count, frontUnits.length); index += 1) {
    updated.push(applyDamageToUnit(frontUnits[index], amount));
  }
  replacePartyUnits(state, updated);
}

function damageRandomBackline(state, amount) {
  const layout = getFormationLayout(state.player.party, state.player.formation);
  const backUnit = layout.find((unit) => !unit.isFront) || layout.at(-1);
  if (!backUnit) {
    state.player.party = [];
    return;
  }
  replacePartyUnits(state, [applyDamageToUnit(backUnit, amount)]);
}

export function resolveObstacleEffect(obstacle, formation, frontUnits) {
  const frontTypes = frontUnits.map((unit) => unit.type);
  switch (obstacle.type) {
    case "narrow-gap":
      return formation === "column"
        ? { passed: true, damageFront: 0, damageBack: 0, message: "Column slips through the gap." }
        : { passed: false, damageFront: 1, damageBack: 1, message: "Too wide for the narrow gap." };
    case "damage-wall":
      return frontTypes.includes("square")
        ? { passed: true, damageFront: 1, damageBack: 0, message: "Tanks absorb the wall impact." }
        : { passed: false, damageFront: 2, damageBack: 1, message: "No tanks up front for the wall." };
    case "breakable-barrier":
      return frontTypes.includes("triangle")
        ? { passed: true, damageFront: 0, damageBack: 0, message: "Melee line breaks the barrier." }
        : { passed: false, damageFront: 2, damageBack: 0, message: "Need triangles in front to break through." };
    case "projectile-field":
      return frontTypes.includes("square")
        ? { passed: true, damageFront: 1, damageBack: 0, message: "Tanks shield the projectile field." }
        : { passed: false, damageFront: 1, damageBack: 1, message: "The field tears through the formation." };
    default:
      return { passed: true, damageFront: 0, damageBack: 0, message: "" };
  }
}

function resolveObstacle(state, obstacle) {
  const frontUnits = getFrontUnits(state.player.party, state.player.formation);
  const result = resolveObstacleEffect(obstacle, state.player.formation, frontUnits);
  setMessage(state, result.message);
  if (result.damageFront > 0) {
    damageFrontUnits(state, 1, result.damageFront);
  }
  for (let index = 0; index < result.damageBack; index += 1) {
    damageRandomBackline(state, 1);
  }
  if (obstacle.type !== "projectile-field") {
    obstacle.resolved = true;
  }
}

function addPickup(state, pickup) {
  state.player.party.push(createUnit(pickup.type, `unit-${state.nextUnitId}`));
  state.nextUnitId += 1;
  state.score += 25;

  const unlocked = maybeUnlockFormationForUnit(state, pickup.type);
  if (unlocked === "spearhead") {
    state.tutorial.step = Math.max(state.tutorial.step, 3);
    setMessage(state, "Triangle joined. Spearhead unlocked.");
    return;
  }
  if (unlocked === "phalanx") {
    setMessage(state, "Square joined. Phalanx unlocked.");
    return;
  }

  setMessage(state, `Picked up ${pickup.type}.`);
}

function spawnPickup(state) {
  const y = state.level.nextPickupY;
  const pickup = createPickupEntity(state, choosePickupType(state), chooseLaneX(state), y);
  state.level.pickups.push(pickup);

  const earlyStretch = state.level.nextPickupY < 3800;
  const spacing = earlyStretch ? 480 + nextRandom(state) * 140 : 360 + nextRandom(state) * 180;
  state.level.nextPickupY += spacing;
}

function spawnEnemy(state) {
  const y = state.level.nextEnemyY;
  const stage = Math.floor(state.distance / 3200);
  const hp = 2 + Math.min(3, stage) + (nextRandom(state) < 0.25 ? 1 : 0);
  const speed = 24 + stage * 3 + Math.floor(nextRandom(state) * 10);
  const enemy = createEnemyEntity(state, chooseLaneX(state), y, hp, speed);
  state.level.enemies.push(enemy);

  const earlyStretch = state.level.nextEnemyY < 3600;
  const spacing = earlyStretch ? 500 + nextRandom(state) * 140 : 380 + nextRandom(state) * 180;
  state.level.nextEnemyY += spacing;
}

function spawnObstacle(state) {
  const type = OBSTACLE_SEQUENCE[state.level.obstaclePatternIndex % OBSTACLE_SEQUENCE.length];
  const obstacle = createObstacleEntity(state, type, state.level.nextObstacleY);
  state.level.obstacles.push(obstacle);
  state.level.obstaclePatternIndex += 1;

  const earlyStretch = state.level.nextObstacleY < 4200;
  const spacing = earlyStretch ? 860 + nextRandom(state) * 180 : 700 + nextRandom(state) * 220;
  state.level.nextObstacleY += spacing + (type === "projectile-field" ? 80 : 0);
}

function cleanupLevel(state) {
  state.level.pickups = state.level.pickups.filter((pickup) => pickup.y > state.distance - 120);
  state.level.enemies = state.level.enemies.filter((enemy) => enemy.y > state.distance - 180 && enemy.hp > 0);
  state.level.obstacles = state.level.obstacles.filter((obstacle) => {
    const tailY = obstacle.y + (obstacle.length || 0);
    return tailY > state.distance - 260;
  });
  state.projectiles = state.projectiles.filter(
    (projectile) =>
      projectile.y > state.distance - 40 &&
      projectile.y < state.distance + 720 &&
      projectile.x > PLAYER_BOUNDS.minX - 80 &&
      projectile.x < PLAYER_BOUNDS.maxX + 80,
  );
}

function maintainSpawnBuffers(state) {
  cleanupLevel(state);
  const maxAheadY = state.distance + SPAWN_BUFFER;
  while (state.level.nextPickupY <= maxAheadY) {
    spawnPickup(state);
  }
  while (state.level.nextEnemyY <= maxAheadY) {
    spawnEnemy(state);
  }
  while (state.level.nextObstacleY <= maxAheadY) {
    spawnObstacle(state);
  }
}

function getCircleVolley(formation) {
  if (formation === "spread") {
    return {
      lockWidth: 140,
      cooldown: 0.72,
      projectiles: [{ offsetX: -72, vx: 0 }, { offsetX: 0, vx: 0 }, { offsetX: 72, vx: 0 }],
    };
  }
  if (formation === "column") {
    return {
      lockWidth: 42,
      cooldown: 0.48,
      projectiles: [{ offsetX: 0, vx: 0 }],
    };
  }
  return {
    lockWidth: 58,
    cooldown: 0.56,
    projectiles: [{ offsetX: 0, vx: 0 }],
  };
}

function updateProjectiles(state, dt) {
  const nextProjectiles = [];
  for (const projectile of state.projectiles) {
    const moved = {
      ...projectile,
      x: projectile.x + (projectile.vx || 0) * dt,
      y: projectile.y + projectile.speed * dt,
    };
    const target = state.level.enemies.find(
      (enemy) => Math.abs(enemy.x - moved.x) < 22 && Math.abs(enemy.y - moved.y) < 24,
    );
    if (target) {
      target.hp -= projectile.damage;
      if (target.hp <= 0) {
        state.kills += 1;
        state.score += 50;
      }
      continue;
    }
    if (moved.y < state.distance + 700) {
      nextProjectiles.push(moved);
    }
  }
  state.projectiles = nextProjectiles;
  state.level.enemies = state.level.enemies.filter((enemy) => enemy.hp > 0);
}

function updateCombat(state, dt) {
  const formationUnits = getFormationLayout(state.player.party, state.player.formation);
  const circles = formationUnits.filter((unit) => unit.type === "circle");
  const triangles = formationUnits.filter((unit) => unit.type === "triangle" && unit.isFront);

  const updatedUnits = [];
  for (const unit of state.player.party) {
    updatedUnits.push({ ...unit, cooldown: Math.max(0, unit.cooldown - dt) });
  }
  state.player.party = updatedUnits;

  const circleVolley = getCircleVolley(state.player.formation);
  for (const circle of circles) {
    const actual = state.player.party.find((unit) => unit.id === circle.id);
    if (!actual || actual.cooldown > 0) {
      continue;
    }
    const target = state.level.enemies.find(
      (enemy) =>
        enemy.y > state.distance &&
        enemy.y - state.distance < 300 &&
        Math.abs(enemy.x - (state.player.x + circle.x)) < circleVolley.lockWidth,
    );
    if (target) {
      actual.cooldown = circleVolley.cooldown;
      for (const projectile of circleVolley.projectiles) {
        state.projectiles.push({
          id: `proj-${state.nextProjectileId}`,
          x: state.player.x + circle.x + projectile.offsetX,
          y: state.distance + 30 + circle.y,
          speed: 360,
          damage: 1,
          vx: projectile.vx,
        });
        state.nextProjectileId += 1;
      }
    }
  }

  for (const triangle of triangles) {
    const actual = state.player.party.find((unit) => unit.id === triangle.id);
    if (!actual || actual.cooldown > 0) {
      continue;
    }
    const target = state.level.enemies.find(
      (enemy) =>
        enemy.y - state.distance < 88 &&
        enemy.y >= state.distance &&
        Math.abs(enemy.x - (state.player.x + triangle.x)) < 44,
    );
    if (target) {
      actual.cooldown = 0.45;
      target.hp -= 1;
      if (target.hp <= 0) {
        state.kills += 1;
        state.score += 50;
      }
    }
  }

  state.level.enemies = state.level.enemies.filter((enemy) => enemy.hp > 0);
}

function updateEnemies(state, dt) {
  for (const enemy of state.level.enemies) {
    enemy.y -= enemy.speed * dt;
  }

  const contact = state.level.enemies.filter(
    (enemy) => Math.abs(enemy.y - state.distance) < 36 && Math.abs(enemy.x - state.player.x) < 80,
  );
  if (contact.length > 0) {
    damageFrontUnits(state, 1, contact.length);
    state.level.enemies = state.level.enemies.filter((enemy) => !contact.includes(enemy));
    setMessage(state, "Enemy contact on the front line.");
  }
}

function updatePickups(state) {
  state.level.pickups = state.level.pickups.filter((pickup) => {
    const hit = Math.abs(pickup.y - state.distance) < 32 && Math.abs(pickup.x - state.player.x) < 34;
    if (hit) {
      addPickup(state, pickup);
    }
    return !hit;
  });
}

function updateObstacles(state, dt) {
  for (const obstacle of state.level.obstacles) {
    if (obstacle.type === "projectile-field" && !obstacle.resolved) {
      if (state.distance > obstacle.y + obstacle.length + 40) {
        obstacle.resolved = true;
        continue;
      }
      const active =
        Math.abs(obstacle.x - state.player.x) < obstacle.width / 2 &&
        state.distance >= obstacle.y - 40 &&
        state.distance <= obstacle.y + obstacle.length;
      if (active) {
        obstacle.timer += dt;
        if (obstacle.timer >= 0.75) {
          obstacle.timer = 0;
          resolveObstacle(state, obstacle);
        }
      }
      continue;
    }

    const hit =
      !obstacle.resolved &&
      Math.abs(obstacle.y - state.distance) < 36 &&
      Math.abs(obstacle.x - state.player.x) < obstacle.width / 2;

    if (hit) {
      resolveObstacle(state, obstacle);
    }
  }
}

function updateTutorial(state) {
  if (state.tutorial.step === 1 && state.distance >= 620) {
    state.tutorial.step = 2;
    setMessage(state, "Gap ahead. Switch to Column.");
    return;
  }

  if (state.tutorial.step === 3 && state.distance >= 1880) {
    state.tutorial.step = 4;
    setMessage(state, "Barrier ahead. Spearhead puts melee in front.");
  }
}

export function updateGame(state, input, dt) {
  if (!state.running) {
    return state;
  }

  const next = structuredClone(state);
  next.player.x = clamp(
    next.player.x + input.moveX * next.player.moveSpeed * dt,
    PLAYER_BOUNDS.minX,
    PLAYER_BOUNDS.maxX,
  );

  if (input.cycleFormation) {
    next.player.formation = cycleFormation(next.player.formation, 1, next.player.availableFormations);
  } else if (input.prevFormation) {
    next.player.formation = cycleFormation(next.player.formation, -1, next.player.availableFormations);
  }

  next.distance += next.player.speed * dt;
  next.score = Math.max(next.score, Math.floor(next.distance) + next.kills * 50);

  maintainSpawnBuffers(next);
  updateTutorial(next);
  updatePickups(next);
  updateObstacles(next, dt);
  updateCombat(next, dt);
  updateProjectiles(next, dt);
  updateEnemies(next, dt);
  maintainSpawnBuffers(next);

  if (next.player.party.length === 0) {
    next.running = false;
    next.gameOver = true;
    setMessage(next, "Formation collapsed. Press restart.");
  }

  return next;
}

export function getRenderableState(state) {
  return {
    ...state,
    formationLabel: FORMATION_LABEL[state.player.formation],
    unitCount: state.player.party.length,
    layout: getFormationLayout(state.player.party, state.player.formation),
    unitColors: UNIT_COLOR,
  };
}
