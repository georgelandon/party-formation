import { createInitialState, getRenderableState, updateGame } from "./gameLogic.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const formationLabel = document.getElementById("formationLabel");
const unitCount = document.getElementById("unitCount");
const scoreLabel = document.getElementById("scoreLabel");

const inputState = {
  left: false,
  right: false,
  cycleRequested: false,
  prevRequested: false,
};

let gameState = createInitialState();
let lastTime = performance.now();
let accumulator = 0;
const FIXED_STEP = 1 / 60;
const playerScreenY = canvas.height - 108;

function requestCycle(direction = 1) {
  if (direction >= 0) {
    inputState.cycleRequested = true;
  } else {
    inputState.prevRequested = true;
  }
}

function resetGame() {
  gameState = createInitialState();
}

function buildFrameInput() {
  return {
    moveX: (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0),
    cycleFormation: inputState.cycleRequested,
    prevFormation: inputState.prevRequested,
  };
}

function consumeOneShotInput() {
  inputState.cycleRequested = false;
  inputState.prevRequested = false;
}

function worldToScreenY(worldY, distance) {
  return playerScreenY - (worldY - distance);
}

function drawUnit(x, y, type, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (type === "circle") {
    ctx.fillStyle = "#ff7f7f";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "square") {
    ctx.fillStyle = "#8bd3dd";
    ctx.fillRect(x - 12, y - 12, 24, 24);
  } else {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x + 14, y + 12);
    ctx.lineTo(x - 14, y + 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacle(obstacle, distance) {
  const y = worldToScreenY(obstacle.y, distance);
  if (y < -160 || y > canvas.height + 200) {
    return;
  }

  ctx.save();
  ctx.translate(obstacle.x, y);
  ctx.globalAlpha = obstacle.resolved ? 0.25 : 0.95;

  if (obstacle.type === "narrow-gap") {
    ctx.fillStyle = "#7f5af0";
    ctx.fillRect(-180, -12, 130, 24);
    ctx.fillRect(50, -12, 130, 24);
    ctx.strokeStyle = "#d6bcff";
    ctx.strokeRect(-40, -18, 80, 36);
  } else if (obstacle.type === "damage-wall") {
    ctx.fillStyle = "#ff8c69";
    ctx.fillRect(-obstacle.width / 2, -14, obstacle.width, 28);
  } else if (obstacle.type === "breakable-barrier") {
    ctx.fillStyle = "#ffcc66";
    ctx.fillRect(-obstacle.width / 2, -10, obstacle.width, 20);
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(-obstacle.width / 4, -12);
    ctx.lineTo(0, 12);
    ctx.lineTo(obstacle.width / 4, -12);
    ctx.stroke();
  } else if (obstacle.type === "projectile-field") {
    const top = worldToScreenY(obstacle.y + obstacle.length, distance);
    const height = top - y;
    ctx.fillStyle = "rgba(255, 111, 145, 0.2)";
    ctx.fillRect(-obstacle.width / 2, 0, obstacle.width, height);
    ctx.strokeStyle = "rgba(255, 173, 173, 0.8)";
    for (let offset = 10; offset < Math.abs(height); offset += 26) {
      ctx.beginPath();
      ctx.moveTo(-obstacle.width / 2, Math.sign(height) * offset);
      ctx.lineTo(obstacle.width / 2, Math.sign(height) * (offset + 8));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawEnemy(enemy, distance) {
  const y = worldToScreenY(enemy.y, distance);
  if (y < -80 || y > canvas.height + 80) {
    return;
  }

  ctx.save();
  ctx.translate(enemy.x, y);
  ctx.fillStyle = "#ff4d6d";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-10, -22, 20, 4);
  ctx.fillStyle = "#70d6ff";
  ctx.fillRect(-10, -22, (enemy.hp / 5) * 20, 4);
  ctx.restore();
}

function drawProjectile(projectile, distance) {
  const y = worldToScreenY(projectile.y, distance);
  if (y < -30 || y > canvas.height + 30) {
    return;
  }
  ctx.fillStyle = "#d7f9ff";
  ctx.fillRect(projectile.x - 2, y - 8, 4, 12);
}

function drawPickup(pickup, distance) {
  const y = worldToScreenY(pickup.y, distance);
  if (y < -40 || y > canvas.height + 40) {
    return;
  }
  drawUnit(pickup.x, y, pickup.type, 0.85);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pickup.x, y, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function render(state) {
  const view = getRenderableState(state);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const laneOffset = (state.distance * 0.55) % 48;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  for (let y = -laneOffset; y < canvas.height + 48; y += 48) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(80, y + 24);
    ctx.moveTo(340, y);
    ctx.lineTo(340, y + 24);
    ctx.stroke();
  }

  for (const obstacle of state.level.obstacles) {
    drawObstacle(obstacle, state.distance);
  }

  for (const pickup of state.level.pickups) {
    drawPickup(pickup, state.distance);
  }

  for (const enemy of state.level.enemies) {
    drawEnemy(enemy, state.distance);
  }

  for (const projectile of state.projectiles) {
    drawProjectile(projectile, state.distance);
  }

  ctx.fillStyle = "rgba(112, 214, 255, 0.16)";
  ctx.fillRect(view.player.x - 24, playerScreenY - 16, 48, 36);

  for (const unit of view.layout) {
    drawUnit(view.player.x + unit.x, playerScreenY + unit.y, unit.type, unit.isFront ? 1 : 0.78);
    if (unit.isFront) {
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1;
      ctx.strokeRect(view.player.x + unit.x - 15, playerScreenY + unit.y - 15, 30, 30);
    }
  }

  formationLabel.textContent = view.formationLabel;
  unitCount.textContent = String(view.unitCount);
  scoreLabel.textContent = String(Math.floor(view.score));

  if (state.message) {
    ctx.fillStyle = "rgba(11,15,34,0.82)";
    ctx.fillRect(30, 24, canvas.width - 60, 48);
    ctx.fillStyle = "#edf2ff";
    ctx.font = "16px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(state.message, canvas.width / 2, 54);
  }

  if (state.gameOver) {
    ctx.fillStyle = "rgba(9, 11, 21, 0.84)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#edf2ff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px Trebuchet MS";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "18px Trebuchet MS";
    ctx.fillText("Press R or tap the canvas to restart", canvas.width / 2, canvas.height / 2 + 28);
  }
}

function tick(now) {
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= FIXED_STEP) {
    gameState = updateGame(gameState, buildFrameInput(), FIXED_STEP);
    consumeOneShotInput();
    accumulator -= FIXED_STEP;
  }

  render(gameState);
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    inputState.left = true;
  }
  if (key === "arrowright" || key === "d") {
    inputState.right = true;
  }
  if (key === " " || key === "e") {
    requestCycle(1);
  }
  if (key === "q") {
    requestCycle(-1);
  }
  if (key === "r" && gameState.gameOver) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    inputState.left = false;
  }
  if (key === "arrowright" || key === "d") {
    inputState.right = false;
  }
});

document.querySelectorAll("[data-action]").forEach((button) => {
  const action = button.getAttribute("data-action");
  const press = () => {
    if (action === "left") {
      inputState.left = true;
    } else if (action === "right") {
      inputState.right = true;
    } else {
      requestCycle(1);
    }
  };
  const release = () => {
    if (action === "left") {
      inputState.left = false;
    } else if (action === "right") {
      inputState.right = false;
    }
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
});

let dragPointerId = null;
canvas.addEventListener("pointerdown", (event) => {
  if (gameState.gameOver) {
    resetGame();
    return;
  }
  dragPointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (dragPointerId !== event.pointerId) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const normalizedX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const diff = normalizedX - gameState.player.x;
  inputState.left = diff < -12;
  inputState.right = diff > 12;
});

function releaseDrag(event) {
  if (dragPointerId !== event.pointerId) {
    return;
  }
  dragPointerId = null;
  inputState.left = false;
  inputState.right = false;
}

canvas.addEventListener("pointerup", releaseDrag);
canvas.addEventListener("pointercancel", releaseDrag);

requestAnimationFrame(tick);
