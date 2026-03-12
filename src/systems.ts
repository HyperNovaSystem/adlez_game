import { defineSystem, query } from '@nova/core';
import {
  Position, Velocity, Player, Health, Enemy, Sword, Projectile,
  Item, Door, Solid, Renderable, Dead,
  GameState, InputState, RoomMap,
  DamageEvent, ItemPickup, EnemyDefeated,
  ENEMY_DEFS, ITEM_HEART, ITEM_KEY, ITEM_RUPEE, ITEM_TRIFORCE,
  ITEM_BOMB,
} from './components.js';
import { isTileSolid, loadRoom } from './map.js';
import type { RoomMapData, GameStateData, InputData } from './components.js';

// ─── Helper: tile collision check ───

function collidesWithTile(
  x: number, y: number, halfW: number, halfH: number,
  map: RoomMapData,
): boolean {
  const ts = map.tileSize;
  // Check all four corners plus center edges
  const checks = [
    { cx: x - halfW + 1, cy: y - halfH + 1 },  // top-left
    { cx: x + halfW - 1, cy: y - halfH + 1 },  // top-right
    { cx: x - halfW + 1, cy: y + halfH - 1 },  // bottom-left
    { cx: x + halfW - 1, cy: y + halfH - 1 },  // bottom-right
  ];

  for (const c of checks) {
    const tileX = Math.floor(c.cx / ts);
    const tileY = Math.floor(c.cy / ts);
    if (tileX < 0 || tileX >= map.roomWidth || tileY < 0 || tileY >= map.roomHeight) {
      return true; // out of bounds = solid
    }
    const tileType = map.tiles[tileY * map.roomWidth + tileX];
    if (isTileSolid(tileType)) {
      return true;
    }
  }
  return false;
}

function boxOverlap(
  ax: number, ay: number, ahw: number, ahh: number,
  bx: number, by: number, bhw: number, bhh: number,
): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

// ─── Player Movement System ───

export const PlayerMovementSystem = defineSystem({
  name: 'PlayerMovement',
  query: query(Position, Player, Health).not(Dead),
  execute({ entities, dt, resources }) {
    const input = resources.get(InputState);
    const map = resources.get(RoomMap);
    const gameState = resources.get(GameState);

    if (gameState.phase !== 'playing') return;

    for (const eid of entities) {
      // Update invincibility timer
      if (Player.invincibleTimer[eid] > 0) {
        Player.invincibleTimer[eid] -= dt;
      }
      // Update attack cooldown
      if (Player.attackCooldown[eid] > 0) {
        Player.attackCooldown[eid] -= dt;
      }

      const speed = Player.speed[eid];
      let dx = 0;
      let dy = 0;

      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;

      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
      }

      // Update facing direction
      if (dx !== 0 || dy !== 0) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          Player.facing[eid] = dx < 0 ? 2 : 3; // left : right
        } else {
          Player.facing[eid] = dy < 0 ? 1 : 0; // up : down
        }
      }

      // Move with tile collision
      const halfW = 6;
      const halfH = 6;
      const newX = Position.x[eid] + dx * speed * dt;
      const newY = Position.y[eid] + dy * speed * dt;

      // Try X movement
      if (!collidesWithTile(newX, Position.y[eid], halfW, halfH, map)) {
        Position.x[eid] = newX;
      }
      // Try Y movement
      if (!collidesWithTile(Position.x[eid], newY, halfW, halfH, map)) {
        Position.y[eid] = newY;
      }
    }
  },
});

// ─── Player Attack System ───

export const PlayerAttackSystem = defineSystem({
  name: 'PlayerAttack',
  query: query(Position, Player).not(Dead),
  execute({ entities, resources, world }) {
    const input = resources.get(InputState);
    const gameState = resources.get(GameState);

    if (gameState.phase !== 'playing') return;

    for (const eid of entities) {
      if (input.attackPressed && Player.attackCooldown[eid] <= 0) {
        Player.attackCooldown[eid] = 0.3; // attack cooldown

        const facing = Player.facing[eid];
        let sx = Position.x[eid];
        let sy = Position.y[eid];
        const swordReach = 14;

        // Position sword in front of player
        if (facing === 0) sy += swordReach;      // down
        else if (facing === 1) sy -= swordReach;  // up
        else if (facing === 2) sx -= swordReach;  // left
        else if (facing === 3) sx += swordReach;  // right

        // Spawn sword hitbox
        const sword = world.spawn();
        world.addComponent(sword, Position, { x: sx, y: sy });
        world.addComponent(sword, Sword, {
          damage: 1,
          lifetime: 0.15,
          owner: eid,
        });

        // Sword renderable - elongated in attack direction
        const isHorizontal = facing === 2 || facing === 3;
        world.addComponent(sword, Renderable, {
          width: isHorizontal ? 14 : 6,
          height: isHorizontal ? 6 : 14,
          color: 0xAAAAFF,
          shape: 0,
        });
      }
    }
  },
});

// ─── Sword Lifetime System ───

export const SwordLifetimeSystem = defineSystem({
  name: 'SwordLifetime',
  query: query(Sword),
  execute({ entities, dt, world }) {
    for (const eid of entities) {
      Sword.lifetime[eid] -= dt;
      if (Sword.lifetime[eid] <= 0) {
        world.destroy(eid);
      }
    }
  },
});

// ─── Sword-Enemy Collision System ───

export const SwordHitSystem = defineSystem({
  name: 'SwordHit',
  query: query(Position, Sword),
  execute({ entities, world, events }) {
    const enemies = world.query(query(Position, Enemy, Health).not(Dead));
    const swordHalfW = 7;
    const swordHalfH = 7;

    for (const swordEid of entities) {
      const sx = Position.x[swordEid];
      const sy = Position.y[swordEid];
      const damage = Sword.damage[swordEid];

      for (const enemyEid of enemies) {
        const ex = Position.x[enemyEid];
        const ey = Position.y[enemyEid];
        const def = ENEMY_DEFS[Enemy.enemyType[enemyEid]];
        const ehw = def.width / 2;
        const ehh = def.height / 2;

        if (boxOverlap(sx, sy, swordHalfW, swordHalfH, ex, ey, ehw, ehh)) {
          Health.current[enemyEid] -= damage;
          events.emit(DamageEvent, {
            target: enemyEid,
            amount: damage,
            source: Sword.owner[swordEid],
          });
        }
      }
    }
  },
});

// ─── Enemy AI System ───

export const EnemyAISystem = defineSystem({
  name: 'EnemyAI',
  query: query(Position, Enemy, Health).not(Dead),
  execute({ entities, dt, world, resources }) {
    const gameState = resources.get(GameState);
    if (gameState.phase !== 'playing') return;

    // Find player
    const players = world.query(query(Position, Player).not(Dead));
    if (players.length === 0) return;
    const playerEid = players[0];
    const px = Position.x[playerEid];
    const py = Position.y[playerEid];

    const map = resources.get(RoomMap);

    for (const eid of entities) {
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      const enemyType = Enemy.enemyType[eid];
      const speed = Enemy.speed[eid];
      const detectRange = Enemy.detectRange[eid];
      const distToPlayer = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);

      Enemy.aiTimer[eid] -= dt;

      // AI behavior based on type
      if (enemyType === 3) {
        // Keese (bat) - erratic movement, always moving
        if (Enemy.aiTimer[eid] <= 0) {
          Enemy.aiTimer[eid] = 0.3 + Math.random() * 0.5;
          if (distToPlayer < detectRange) {
            // Move toward player with randomness
            const angle = Math.atan2(py - ey, px - ex) + (Math.random() - 0.5) * 1.5;
            Velocity.x[eid] = Math.cos(angle) * speed;
            Velocity.y[eid] = Math.sin(angle) * speed;
          } else {
            const angle = Math.random() * Math.PI * 2;
            Velocity.x[eid] = Math.cos(angle) * speed * 0.6;
            Velocity.y[eid] = Math.sin(angle) * speed * 0.6;
          }
        }
      } else if (enemyType === 0) {
        // Octorok - wander in cardinal directions, pause, shoot
        if (Enemy.aiTimer[eid] <= 0) {
          if (Enemy.aiState[eid] === 1) {
            // Was wandering, now pause
            Enemy.aiState[eid] = 0;
            Enemy.aiTimer[eid] = 0.5 + Math.random() * 1.0;
            Velocity.x[eid] = 0;
            Velocity.y[eid] = 0;

            // Shoot projectile if player in range
            if (distToPlayer < detectRange) {
              const dir = Enemy.moveDir[eid];
              const proj = world.spawn();
              world.addComponent(proj, Position, { x: ex, y: ey });
              let pvx = 0, pvy = 0;
              const projSpeed = 80;
              if (dir === 0) pvy = projSpeed;
              else if (dir === 1) pvy = -projSpeed;
              else if (dir === 2) pvx = -projSpeed;
              else pvx = projSpeed;
              world.addComponent(proj, Velocity, { x: pvx, y: pvy });
              world.addComponent(proj, Projectile, {
                direction: dir,
                speed: projSpeed,
                damage: 1,
                lifetime: 2.0,
                owner: eid,
              });
              world.addComponent(proj, Renderable, {
                width: 6,
                height: 6,
                color: 0x886644,
                shape: 1,
              });
            }
          } else {
            // Was idle, now wander
            Enemy.aiState[eid] = 1;
            Enemy.aiTimer[eid] = 0.8 + Math.random() * 1.2;
            const dir = Math.floor(Math.random() * 4);
            Enemy.moveDir[eid] = dir;
            if (dir === 0) { Velocity.x[eid] = 0; Velocity.y[eid] = speed; }
            else if (dir === 1) { Velocity.x[eid] = 0; Velocity.y[eid] = -speed; }
            else if (dir === 2) { Velocity.x[eid] = -speed; Velocity.y[eid] = 0; }
            else { Velocity.x[eid] = speed; Velocity.y[eid] = 0; }
          }
        }
      } else if (enemyType === 1) {
        // Moblin - wander, then charge at player when detected
        if (distToPlayer < detectRange) {
          // Chase player
          Enemy.aiState[eid] = 2;
          const angle = Math.atan2(py - ey, px - ex);
          Velocity.x[eid] = Math.cos(angle) * speed * 1.3;
          Velocity.y[eid] = Math.sin(angle) * speed * 1.3;
        } else if (Enemy.aiTimer[eid] <= 0) {
          Enemy.aiState[eid] = 1;
          Enemy.aiTimer[eid] = 1.0 + Math.random() * 1.5;
          const dir = Math.floor(Math.random() * 4);
          Enemy.moveDir[eid] = dir;
          if (dir === 0) { Velocity.x[eid] = 0; Velocity.y[eid] = speed; }
          else if (dir === 1) { Velocity.x[eid] = 0; Velocity.y[eid] = -speed; }
          else if (dir === 2) { Velocity.x[eid] = -speed; Velocity.y[eid] = 0; }
          else { Velocity.x[eid] = speed; Velocity.y[eid] = 0; }
        }
      } else if (enemyType === 2) {
        // Darknut - slow patrol, turns toward player when close
        if (Enemy.aiTimer[eid] <= 0) {
          Enemy.aiTimer[eid] = 1.5 + Math.random() * 1.0;
          if (distToPlayer < detectRange) {
            const angle = Math.atan2(py - ey, px - ex);
            Velocity.x[eid] = Math.cos(angle) * speed;
            Velocity.y[eid] = Math.sin(angle) * speed;
          } else {
            const dir = Math.floor(Math.random() * 4);
            Enemy.moveDir[eid] = dir;
            if (dir === 0) { Velocity.x[eid] = 0; Velocity.y[eid] = speed; }
            else if (dir === 1) { Velocity.x[eid] = 0; Velocity.y[eid] = -speed; }
            else if (dir === 2) { Velocity.x[eid] = -speed; Velocity.y[eid] = 0; }
            else { Velocity.x[eid] = speed; Velocity.y[eid] = 0; }
          }
        }
      } else if (enemyType === 4) {
        // Gel (slime) - slow random hops
        if (Enemy.aiTimer[eid] <= 0) {
          if (Enemy.aiState[eid] === 0) {
            // Hop
            Enemy.aiState[eid] = 1;
            Enemy.aiTimer[eid] = 0.3;
            const angle = distToPlayer < detectRange
              ? Math.atan2(py - ey, px - ex) + (Math.random() - 0.5) * 0.8
              : Math.random() * Math.PI * 2;
            Velocity.x[eid] = Math.cos(angle) * speed * 2;
            Velocity.y[eid] = Math.sin(angle) * speed * 2;
          } else {
            // Rest
            Enemy.aiState[eid] = 0;
            Enemy.aiTimer[eid] = 0.8 + Math.random() * 1.0;
            Velocity.x[eid] = 0;
            Velocity.y[eid] = 0;
          }
        }
      }

      // Apply movement with tile collision
      const def = ENEMY_DEFS[enemyType];
      const halfW = def.width / 2;
      const halfH = def.height / 2;
      const newX = ex + Velocity.x[eid] * dt;
      const newY = ey + Velocity.y[eid] * dt;

      if (!collidesWithTile(newX, ey, halfW, halfH, map)) {
        Position.x[eid] = newX;
      } else {
        Velocity.x[eid] = -Velocity.x[eid]; // bounce
      }
      if (!collidesWithTile(Position.x[eid], newY, halfW, halfH, map)) {
        Position.y[eid] = newY;
      } else {
        Velocity.y[eid] = -Velocity.y[eid]; // bounce
      }
    }
  },
});

// ─── Enemy-Player Collision (contact damage) ───

export const EnemyContactSystem = defineSystem({
  name: 'EnemyContact',
  query: query(Position, Enemy).not(Dead),
  execute({ entities, world, events }) {
    const players = world.query(query(Position, Player, Health).not(Dead));
    if (players.length === 0) return;
    const pEid = players[0];

    if (Player.invincibleTimer[pEid] > 0) return;

    const px = Position.x[pEid];
    const py = Position.y[pEid];
    const phw = 6;
    const phh = 6;

    for (const eid of entities) {
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      const def = ENEMY_DEFS[Enemy.enemyType[eid]];
      const ehw = def.width / 2;
      const ehh = def.height / 2;

      if (boxOverlap(px, py, phw, phh, ex, ey, ehw, ehh)) {
        const damage = Enemy.damage[eid];
        Health.current[pEid] -= damage;
        Player.invincibleTimer[pEid] = 1.0; // 1 second invincibility

        // Knockback player away from enemy
        const angle = Math.atan2(py - ey, px - ex);
        Position.x[pEid] += Math.cos(angle) * 16;
        Position.y[pEid] += Math.sin(angle) * 16;

        events.emit(DamageEvent, {
          target: pEid,
          amount: damage,
          source: eid,
        });
        break; // Only take damage from one enemy per frame
      }
    }
  },
});

// ─── Projectile Movement System ───

export const ProjectileMovementSystem = defineSystem({
  name: 'ProjectileMovement',
  query: query(Position, Velocity, Projectile),
  execute({ entities, dt, world, resources }) {
    const map = resources.get(RoomMap);

    for (const eid of entities) {
      Position.x[eid] += Velocity.x[eid] * dt;
      Position.y[eid] += Velocity.y[eid] * dt;

      Projectile.lifetime[eid] -= dt;

      // Destroy if expired or hits wall
      const x = Position.x[eid];
      const y = Position.y[eid];
      if (Projectile.lifetime[eid] <= 0 || collidesWithTile(x, y, 2, 2, map)) {
        world.destroy(eid);
        continue;
      }

      // Check collision with player
      const players = world.query(query(Position, Player, Health).not(Dead));
      if (players.length > 0) {
        const pEid = players[0];
        if (Player.invincibleTimer[pEid] <= 0) {
          const px = Position.x[pEid];
          const py = Position.y[pEid];
          if (boxOverlap(x, y, 3, 3, px, py, 6, 6)) {
            Health.current[pEid] -= Projectile.damage[eid];
            Player.invincibleTimer[pEid] = 1.0;
            world.destroy(eid);
          }
        }
      }
    }
  },
});

// ─── Death System ───

export const DeathSystem = defineSystem({
  name: 'Death',
  query: query(Health, Enemy).not(Dead),
  execute({ entities, world, events }) {
    for (const eid of entities) {
      if (Health.current[eid] <= 0) {
        world.addComponent(eid, Dead);
        events.emit(EnemyDefeated, {
          enemyType: Enemy.enemyType[eid],
          x: Position.x[eid],
          y: Position.y[eid],
        });

        // Chance to drop a heart or rupee
        const drop = Math.random();
        if (drop < 0.3) {
          const item = world.spawn();
          world.addComponent(item, Position, { x: Position.x[eid], y: Position.y[eid] });
          if (drop < 0.15) {
            world.addComponent(item, Item, { itemType: ITEM_HEART, value: 1 });
            world.addComponent(item, Renderable, {
              width: 10, height: 10, color: 0xFF3366, shape: 4,
            });
          } else {
            world.addComponent(item, Item, { itemType: ITEM_RUPEE, value: 1 });
            world.addComponent(item, Renderable, {
              width: 8, height: 10, color: 0x33CC33, shape: 4,
            });
          }
        }
      }
    }
  },
});

// ─── Player Death System ───

export const PlayerDeathSystem = defineSystem({
  name: 'PlayerDeath',
  query: query(Player, Health).not(Dead),
  execute({ entities, resources }) {
    const gameState = resources.get(GameState);
    for (const eid of entities) {
      if (Health.current[eid] <= 0) {
        gameState.phase = 'gameover';
      }
    }
  },
});

// ─── Item Pickup System ───

export const ItemPickupSystem = defineSystem({
  name: 'ItemPickup',
  query: query(Position, Item, Renderable).not(Dead),
  execute({ entities, world, resources, events }) {
    const players = world.query(query(Position, Player, Health).not(Dead));
    if (players.length === 0) return;
    const pEid = players[0];
    const px = Position.x[pEid];
    const py = Position.y[pEid];
    const gameState = resources.get(GameState);

    for (const eid of entities) {
      const ix = Position.x[eid];
      const iy = Position.y[eid];

      if (boxOverlap(px, py, 7, 7, ix, iy, 6, 6)) {
        const itemType = Item.itemType[eid];
        const value = Item.value[eid];

        if (itemType === ITEM_HEART) {
          Health.current[pEid] = Math.min(Health.current[pEid] + value, Health.max[pEid]);
        } else if (itemType === ITEM_KEY) {
          gameState.keys += value;
        } else if (itemType === ITEM_RUPEE) {
          gameState.rupees += value;
        } else if (itemType === ITEM_TRIFORCE) {
          gameState.triforceShards += value;
          if (gameState.triforceShards >= gameState.totalTriforceShards) {
            gameState.phase = 'victory';
          }
        } else if (itemType === ITEM_BOMB) {
          gameState.bombs += value;
        }

        events.emit(ItemPickup, { itemType, value });
        world.destroy(eid);
      }
    }
  },
});

// ─── Door / Room Transition System ───

export const DoorSystem = defineSystem({
  name: 'DoorSystem',
  query: query(Position, Door),
  execute({ entities, resources, world }) {
    const gameState = resources.get(GameState);
    const input = resources.get(InputState);
    const map = resources.get(RoomMap);

    if (gameState.phase !== 'playing') return;

    const players = world.query(query(Position, Player).not(Dead));
    if (players.length === 0) return;
    const pEid = players[0];
    const px = Position.x[pEid];
    const py = Position.y[pEid];

    for (const eid of entities) {
      const dx = Position.x[eid];
      const dy = Position.y[eid];

      if (boxOverlap(px, py, 6, 6, dx, dy, 8, 8)) {
        const lockType = Door.lockType[eid];

        // Check if locked
        if (lockType === 1) {
          if (gameState.keys <= 0) continue; // need a key
          if (!input.interactPressed) continue; // need to press interact
          gameState.keys--;
        } else if (lockType === 2) {
          // Boss door - need special key (for future expansion)
          if (!input.interactPressed) continue;
        }

        // Trigger room transition
        const targetRoom = Door.targetRoom[eid];
        const targetX = Door.targetX[eid];
        const targetY = Door.targetY[eid];

        gameState.phase = 'transition';
        gameState.transitionTimer = 0.4;
        gameState.transitionDir = Door.direction[eid];
        gameState.transitionTargetRoom = targetRoom;
        gameState.transitionTargetX = targetX * map.tileSize + map.tileSize / 2;
        gameState.transitionTargetY = targetY * map.tileSize + map.tileSize / 2;
        break;
      }
    }
  },
});

// ─── Room Transition System ───

export const RoomTransitionSystem = defineSystem({
  name: 'RoomTransition',
  execute({ dt, resources, world }) {
    const gameState = resources.get(GameState);
    if (gameState.phase !== 'transition') return;

    gameState.transitionTimer -= dt;

    if (gameState.transitionTimer <= 0) {
      // Perform the room switch
      const map = resources.get(RoomMap);
      const oldRoom = gameState.currentRoom;
      const newRoom = gameState.transitionTargetRoom;

      // Destroy all non-player entities
      const allEnemies = world.query(query(Enemy));
      for (const eid of allEnemies) world.destroy(eid);
      const allItems = world.query(query(Item));
      for (const eid of allItems) world.destroy(eid);
      const allSwords = world.query(query(Sword));
      for (const eid of allSwords) world.destroy(eid);
      const allProjectiles = world.query(query(Projectile));
      for (const eid of allProjectiles) world.destroy(eid);
      const allDoors = world.query(query(Door));
      for (const eid of allDoors) world.destroy(eid);

      // Load new room
      gameState.currentRoom = newRoom;
      gameState.visitedRooms.add(newRoom);
      loadRoom(map, newRoom);
      spawnRoomEntities(world, map, newRoom, gameState);

      // Move player to target position
      const players = world.query(query(Position, Player).not(Dead));
      if (players.length > 0) {
        Position.x[players[0]] = gameState.transitionTargetX;
        Position.y[players[0]] = gameState.transitionTargetY;
      }

      gameState.phase = 'playing';
    }
  },
});

// ─── Cleanup System ───

export const CleanupSystem = defineSystem({
  name: 'Cleanup',
  query: query(Dead),
  execute({ entities, world }) {
    for (const eid of entities) {
      // Don't destroy the player entity
      if (world.hasComponent(eid, Player)) continue;
      world.destroy(eid);
    }
  },
});

// ─── Room Clear Check System ───

export const RoomClearSystem = defineSystem({
  name: 'RoomClear',
  execute({ resources, world }) {
    const gameState = resources.get(GameState);
    if (gameState.phase !== 'playing') return;

    const aliveEnemies = world.query(query(Enemy, Health).not(Dead));
    if (aliveEnemies.length === 0 && !gameState.clearedRooms.has(gameState.currentRoom)) {
      gameState.clearedRooms.add(gameState.currentRoom);
    }
  },
});

// ─── Spawn room entities helper ───

export function spawnRoomEntities(
  world: any,
  map: RoomMapData,
  roomIndex: number,
  gameState: GameStateData,
): void {
  const room = map.rooms[roomIndex];
  const ts = map.tileSize;

  // Don't respawn enemies/items in cleared rooms (except triforce)
  const isCleared = gameState.clearedRooms.has(roomIndex);

  // Spawn enemies
  if (!isCleared) {
    for (const spawn of room.enemies) {
      const def = ENEMY_DEFS[spawn.type];
      const eid = world.spawn();
      world.addComponent(eid, Position, {
        x: spawn.tileX * ts + ts / 2,
        y: spawn.tileY * ts + ts / 2,
      });
      world.addComponent(eid, Velocity, { x: 0, y: 0 });
      world.addComponent(eid, Enemy, {
        enemyType: spawn.type,
        speed: def.speed,
        aiState: 0,
        aiTimer: Math.random() * 2,
        moveDir: Math.floor(Math.random() * 4),
        detectRange: def.detectRange,
        damage: def.damage,
      });
      world.addComponent(eid, Health, {
        current: def.health,
        max: def.health,
      });
      world.addComponent(eid, Renderable, {
        width: def.width,
        height: def.height,
        color: def.color,
        shape: 0,
      });
    }
  }

  // Spawn items (only if room not cleared, except triforce which always appears in cleared boss room)
  for (const spawn of room.items) {
    if (isCleared && spawn.type !== ITEM_TRIFORCE) continue;
    // Don't spawn triforce in boss room if already collected
    if (spawn.type === ITEM_TRIFORCE && gameState.triforceShards >= gameState.totalTriforceShards) continue;

    const eid = world.spawn();
    world.addComponent(eid, Position, {
      x: spawn.tileX * ts + ts / 2,
      y: spawn.tileY * ts + ts / 2,
    });
    world.addComponent(eid, Item, { itemType: spawn.type, value: spawn.value });

    // Visual appearance based on type
    let color = 0xFFFFFF;
    let shape = 4; // diamond
    let w = 8, h = 10;
    if (spawn.type === ITEM_HEART) { color = 0xFF3366; shape = 4; w = 10; h = 10; }
    else if (spawn.type === ITEM_KEY) { color = 0xFFDD00; shape = 0; w = 6; h = 12; }
    else if (spawn.type === ITEM_RUPEE) { color = 0x33CC33; shape = 4; w = 8; h = 10; }
    else if (spawn.type === ITEM_TRIFORCE) { color = 0xFFDD00; shape = 2; w = 14; h = 14; }
    else if (spawn.type === ITEM_BOMB) { color = 0x333333; shape = 1; w = 10; h = 10; }

    world.addComponent(eid, Renderable, { width: w, height: h, color, shape });
  }

  // Spawn doors
  for (const spawn of room.doors) {
    const eid = world.spawn();
    world.addComponent(eid, Position, {
      x: spawn.tileX * ts + ts / 2,
      y: spawn.tileY * ts + ts / 2,
    });
    world.addComponent(eid, Door, {
      targetRoom: spawn.targetRoom,
      targetX: spawn.targetX,
      targetY: spawn.targetY,
      lockType: spawn.lockType,
      direction: spawn.direction,
    });
  }
}

// ─── Export all systems grouped by stage ───

export function getGameplaySystems() {
  return {
    input: [PlayerMovementSystem, PlayerAttackSystem],
    simulation: [
      EnemyAISystem,
      ProjectileMovementSystem,
      SwordLifetimeSystem,
    ],
    gameplay: [
      SwordHitSystem,
      EnemyContactSystem,
      DeathSystem,
      PlayerDeathSystem,
      ItemPickupSystem,
      DoorSystem,
      RoomTransitionSystem,
      RoomClearSystem,
    ],
    cleanup: [CleanupSystem],
  };
}
