import { Engine } from '@nova/core';
import {
  Position, Velocity, Player, Health, Enemy, Sword, Projectile,
  Item, Door, Solid, Renderable, AnimationState, Dead, Invincible, Pushable,
  GameState, InputState, RoomMap,
} from './components.js';
import type { GameStateData, InputData } from './components.js';
import { getGameplaySystems, spawnRoomEntities } from './systems.js';
import { createRoomMap, loadRoom } from './map.js';
import { AdlezRenderer } from './renderer.js';

// ─── Initialize Engine ───

const engine = new Engine({
  maxEntities: 5_000,
  fixedTimestep: 1 / 60,
  seed: 42,
  headless: false,
});

// Register all components
const components = [
  Position, Velocity, Player, Health, Enemy, Sword, Projectile,
  Item, Door, Solid, Renderable, AnimationState, Dead, Invincible, Pushable,
];
for (const comp of components) {
  engine.registerComponent(comp);
}

// ─── Initialize Resources ───

const roomMap = createRoomMap();
loadRoom(roomMap, 0);
engine.insertResource(RoomMap, roomMap);

const gameState: GameStateData = {
  currentRoom: 0,
  keys: 0,
  rupees: 0,
  triforceShards: 0,
  totalTriforceShards: 1,
  bombs: 0,
  hasBoomerang: false,
  phase: 'title',
  transitionTimer: 0,
  transitionDir: 0,
  transitionTargetRoom: 0,
  transitionTargetX: 0,
  transitionTargetY: 0,
  clearedRooms: new Set(),
  visitedRooms: new Set([0]),
};
engine.insertResource(GameState, gameState);

const inputState: InputData = {
  up: false,
  down: false,
  left: false,
  right: false,
  attack: false,
  interact: false,
  attackPressed: false,
  interactPressed: false,
};
engine.insertResource(InputState, inputState);

// ─── Register Systems ───

const systems = getGameplaySystems();
engine.addStage('input', systems.input);
engine.addStage('simulation', systems.simulation);
engine.addStage('gameplay', systems.gameplay);
engine.addStage('cleanup', systems.cleanup);

// ─── Canvas Setup ───

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new AdlezRenderer(canvas, engine.world, 3);

// ─── Player Spawning ───

let playerEid = -1;

function spawnPlayer(): void {
  const ts = roomMap.tileSize;
  playerEid = engine.world.spawn();
  engine.world.addComponent(playerEid, Position, {
    x: 7 * ts + ts / 2,
    y: 5 * ts + ts / 2,
  });
  engine.world.addComponent(playerEid, Velocity, { x: 0, y: 0 });
  engine.world.addComponent(playerEid, Player, {
    facing: 0,
    speed: 80,
    invincibleTimer: 0,
    attackCooldown: 0,
  });
  engine.world.addComponent(playerEid, Health, {
    current: 6,
    max: 6,
  });
  engine.world.addComponent(playerEid, Renderable, {
    width: 12,
    height: 12,
    color: 0x4CAF50,
    shape: 0,
  });
}

function startGame(): void {
  gameState.phase = 'playing';
  gameState.currentRoom = 0;
  gameState.keys = 0;
  gameState.rupees = 0;
  gameState.triforceShards = 0;
  gameState.bombs = 0;
  gameState.hasBoomerang = false;
  gameState.clearedRooms = new Set();
  gameState.visitedRooms = new Set([0]);

  loadRoom(roomMap, 0);
  spawnPlayer();
  spawnRoomEntities(engine.world, roomMap, 0, gameState);
}

// ─── Input Handling ───

const keyMap: Record<string, keyof InputData> = {
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'w': 'up',
  'W': 'up',
  's': 'down',
  'S': 'down',
  'a': 'left',
  'A': 'left',
  'd': 'right',
  'D': 'right',
};

document.addEventListener('keydown', (e) => {
  const mapped = keyMap[e.key];
  if (mapped) {
    (inputState as any)[mapped] = true;
    e.preventDefault();
  }
  if (e.key === ' ') {
    inputState.attack = true;
    inputState.attackPressed = true;
    e.preventDefault();

    if (gameState.phase === 'title') {
      startGame();
    }
  }
  if (e.key === 'e' || e.key === 'E') {
    inputState.interact = true;
    inputState.interactPressed = true;
  }
  if ((e.key === 'r' || e.key === 'R') && (gameState.phase === 'gameover' || gameState.phase === 'victory')) {
    // Restart - reload page for clean state
    // NOTE: Engine deficiency - no way to reset world state cleanly
    location.reload();
  }
});

document.addEventListener('keyup', (e) => {
  const mapped = keyMap[e.key];
  if (mapped) {
    (inputState as any)[mapped] = false;
  }
  if (e.key === ' ') {
    inputState.attack = false;
  }
  if (e.key === 'e' || e.key === 'E') {
    inputState.interact = false;
  }
});

// ─── Game Loop ───

let lastTime = performance.now() / 1000;
let accumulator = 0;
const fixedDt = 1 / 60;

function gameLoop(): void {
  const now = performance.now() / 1000;
  const wallDt = Math.min(now - lastTime, 0.1);
  lastTime = now;

  accumulator += wallDt;

  while (accumulator >= fixedDt) {
    engine.tick();
    accumulator -= fixedDt;

    // Clear per-frame input flags
    inputState.attackPressed = false;
    inputState.interactPressed = false;
  }

  renderer.render();
  requestAnimationFrame(gameLoop);
}

// ─── Start ───

requestAnimationFrame(gameLoop);
