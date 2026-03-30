export const FORMATIONS = ["phalanx", "spearhead", "spread", "column"];
export const UNIT_TYPES = ["square", "triangle", "circle"];

const PLAYER_BOUNDS = { minX: 60, maxX: 360 };
const UNIT_HP = { square: 3, triangle: 2, circle: 1 };
const UNIT_ROLE = { square: "tank", triangle: "melee", circle: "ranged" };
const UNIT_COLOR = { square: "#8bd3dd", triangle: "#ffd166", circle: "#ff7f7f" };
const FORMATION_LABEL = {
  phalanx: "Phalanx",
  spearhead: "Spearhead",
  spread: "Spread",
  column: "Column",
};

const LEVEL = {
  pickups: [
    { id: "pickup-1", type: "circle", x: 110, y: 180 },
    { id: "pickup-2", type: "triangle", x: 310, y: 360 },
    { id: "pickup-3", type: "square", x: 170, y: 620 },
    { id: "pickup-4", type: "circle", x: 290, y: 860 },
    { id: "pickup-5", type: "triangle", x: 130, y: 1180 },
    { id: "pickup-6", type: "square", x: 230, y: 1510 },
    { id: "pickup-7", type: "circle", x: 320, y: 1775 },
    { id: "pickup-8", type: "triangle", x: 115, y: 2140 },
  ],
  obstacles: [
    { id: "obs-1", type: "damage-wall", x: 210, y: 460, width: 190 },
    { id: "obs-2", type: "breakable-barrier", x: 210, y: 980, width: 180 },
    { id: "obs-3", type: "narrow-gap", x: 210, y: 1380, width: 80 },
    { id: "obs-4", type: "projectile-field", x: 210, y: 1880, width: 220, length: 180 },
    { id: "obs-5", type: "damage-wall", x: 210, y: 2420, width: 210 },
    { id: "obs-6", type: "breakable-barrier", x: 210, y: 2790, width: 200 },
    { id: "obs-7", type: "narrow-gap", x: 210, y: 3220, width: 80 },
  ],
  enemies: [
    { id: "enemy-1", x: 210, y: 300, hp: 2, speed: 30 },
    { id: "enemy-2", x: 110, y: 720, hp: 2, speed: 35 },
    { id: "enemy-3", x: 295, y: 1100, hp: 3, speed: 40 },
    { id: "enemy-4", x: 180, y: 1650, hp: 3, speed: 45 },
    { id: "enemy-5", x: 250, y: 2050, hp: 4, speed: 50 },
    { id: "enemy-6", x: 130, y: 2560, hp: 4, speed: 50 },
    { id: "enemy-7", x: 300, y: 3010, hp: 5, speed: 52 },
  ],
};

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

export function createInitialState() {
  return {
    running: true,
    gameOver: false,
    score: 0,
    kills: 0,
    nextUnitId: 4,
    nextProjectileId: 1,
    distance: 0,
    player: {
      x: 210,
      speed: 125,
      moveSpeed: 215,
      formation: "phalanx",
      party: [
        createUnit("square", "unit-1"),
        createUnit("triangle", "unit-2"),
        createUnit("circle", "unit-3"),
      ],
    },
    level: {
      pickups: LEVEL.pickups.map((pickup) => ({ ...pickup })),
      obstacles: LEVEL.obstacles.map((obstacle) => ({ ...obstacle, resolved: false, timer: 0 })),
      enemies: LEVEL.enemies.map((enemy) => ({ ...enemy })),
    },
    projectiles: [],
    message: "",
  };
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
      x: -60 + spacing * index,
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

export function cycleFormation(formation, direction = 1) {
  const index = FORMATIONS.indexOf(formation);
  const nextIndex = (index + direction + FORMATIONS.length) % FORMATIONS.length;
  return FORMATIONS[nextIndex];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function removeUnitById(party, id) {
  return party.filter((unit) => unit.id !== id);
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
    const unit = frontUnits[index];
    updated.push(applyDamageToUnit(unit, amount));
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
  state.message = result.message;
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
  state.message = `Picked up ${pickup.type}.`;
}

function updateProjectiles(state, dt) {
  const nextProjectiles = [];
  for (const projectile of state.projectiles) {
    const moved = { ...projectile, y: projectile.y + projectile.speed * dt };
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

  for (const circle of circles) {
    const actual = state.player.party.find((unit) => unit.id === circle.id);
    if (!actual || actual.cooldown > 0) {
      continue;
    }
    const target = state.level.enemies.find(
      (enemy) => enemy.y > state.distance && enemy.y - state.distance < 280 && Math.abs(enemy.x - (state.player.x + circle.x)) < 50,
    );
    if (target) {
      actual.cooldown = 0.55;
      state.projectiles.push({
        id: `proj-${state.nextProjectileId}`,
        x: state.player.x + circle.x,
        y: state.distance + 30 + circle.y,
        speed: 360,
        damage: 1,
      });
      state.nextProjectileId += 1;
    }
  }

  for (const triangle of triangles) {
    const actual = state.player.party.find((unit) => unit.id === triangle.id);
    if (!actual || actual.cooldown > 0) {
      continue;
    }
    const target = state.level.enemies.find(
      (enemy) => enemy.y - state.distance < 88 && enemy.y >= state.distance && Math.abs(enemy.x - (state.player.x + triangle.x)) < 44,
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
    state.message = "Enemy contact on the front line.";
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
    next.player.formation = cycleFormation(next.player.formation, 1);
  } else if (input.prevFormation) {
    next.player.formation = cycleFormation(next.player.formation, -1);
  }

  next.distance += next.player.speed * dt;
  next.score = Math.max(next.score, Math.floor(next.distance) + next.kills * 50);

  updatePickups(next);
  updateObstacles(next, dt);
  updateCombat(next, dt);
  updateProjectiles(next, dt);
  updateEnemies(next, dt);

  if (next.player.party.length === 0) {
    next.running = false;
    next.gameOver = true;
    next.message = "Formation collapsed. Press restart.";
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
