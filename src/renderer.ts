import { query } from '@nova/core';
import type { World } from '@nova/core';
import {
  Position, Player, Health, Enemy, Sword, Projectile,
  Item, Door, Renderable, Dead,
  GameState, RoomMap, InputState,
  TILE_FLOOR, TILE_WALL, TILE_WATER, TILE_TREE,
  TILE_SAND, TILE_GRASS, TILE_BRIDGE, TILE_STAIRS,
  TILE_DUNGEON_FLOOR, TILE_DUNGEON_WALL,
  ENEMY_DEFS, ITEM_HEART, ITEM_KEY, ITEM_RUPEE,
  ITEM_TRIFORCE, ITEM_BOMB,
} from './components.js';
import type { GameStateData, RoomMapData } from './components.js';

function colorToCSS(packed: number): string {
  const r = (packed >> 16) & 0xFF;
  const g = (packed >> 8) & 0xFF;
  const b = packed & 0xFF;
  return `rgb(${r},${g},${b})`;
}

function colorToAlpha(packed: number, a: number): string {
  const r = (packed >> 16) & 0xFF;
  const g = (packed >> 8) & 0xFF;
  const b = packed & 0xFF;
  return `rgba(${r},${g},${b},${a})`;
}

// Tile colors
const TILE_COLORS: Record<number, string> = {
  [TILE_FLOOR]: '#8B7355',
  [TILE_WALL]: '#555555',
  [TILE_WATER]: '#2244AA',
  [TILE_TREE]: '#1B5E20',
  [TILE_SAND]: '#C2B280',
  [TILE_GRASS]: '#2E7D32',
  [TILE_BRIDGE]: '#8D6E3F',
  [TILE_STAIRS]: '#6D6D6D',
  [TILE_DUNGEON_FLOOR]: '#3A3A4A',
  [TILE_DUNGEON_WALL]: '#1A1A2E',
};

export class AdlezRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: World;
  private scale: number;
  private animFrame = 0;

  constructor(canvas: HTMLCanvasElement, world: World, scale: number = 3) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = world;
    this.scale = scale;
    // Disable image smoothing for pixel art look
    this.ctx.imageSmoothingEnabled = false;
  }

  render(): void {
    this.animFrame++;
    const ctx = this.ctx;
    const world = this.world;
    const map = world.getResource(RoomMap);
    const gameState = world.getResource(GameState);
    const s = this.scale;

    const gameW = map.roomWidth * map.tileSize;
    const gameH = map.roomHeight * map.tileSize;
    const hudHeight = 24;
    const canvasW = gameW * s;
    const canvasH = (gameH + hudHeight) * s;

    if (this.canvas.width !== canvasW || this.canvas.height !== canvasH) {
      this.canvas.width = canvasW;
      this.canvas.height = canvasH;
      this.ctx.imageSmoothingEnabled = false;
    }

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Save context, apply scale and HUD offset
    ctx.save();
    ctx.scale(s, s);
    ctx.translate(0, hudHeight);

    // Transition fade
    if (gameState.phase === 'transition') {
      const alpha = 1 - (gameState.transitionTimer / 0.4);
      this.drawTiles(ctx, map);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, gameW, gameH);
      ctx.restore();
      this.drawHUD(ctx, map, gameState, s, hudHeight);
      return;
    }

    // Draw tiles
    this.drawTiles(ctx, map);

    // Draw doors
    this.drawDoors(ctx, world, map, gameState);

    // Draw items
    this.drawItems(ctx, world);

    // Draw enemies
    this.drawEnemies(ctx, world);

    // Draw player
    this.drawPlayer(ctx, world);

    // Draw sword
    this.drawSwords(ctx, world);

    // Draw projectiles
    this.drawProjectiles(ctx, world);

    ctx.restore();

    // Draw HUD (in screen space, scaled)
    this.drawHUD(ctx, map, gameState, s, hudHeight);

    // Draw overlays
    if (gameState.phase === 'gameover') {
      this.drawOverlay(ctx, canvasW, canvasH, 'GAME OVER', '#FF4444', 'You have fallen...');
    } else if (gameState.phase === 'victory') {
      this.drawOverlay(ctx, canvasW, canvasH, 'VICTORY!', '#FFD700', 'You collected the Triforce!');
    } else if (gameState.phase === 'title') {
      this.drawTitleScreen(ctx, canvasW, canvasH);
    }
  }

  private drawTiles(ctx: CanvasRenderingContext2D, map: RoomMapData): void {
    const ts = map.tileSize;
    for (let y = 0; y < map.roomHeight; y++) {
      for (let x = 0; x < map.roomWidth; x++) {
        const tile = map.tiles[y * map.roomWidth + x];
        ctx.fillStyle = TILE_COLORS[tile] ?? '#000';
        ctx.fillRect(x * ts, y * ts, ts, ts);

        // Add texture details
        if (tile === TILE_GRASS) {
          // Grass blades
          ctx.fillStyle = '#388E3C';
          const seed = (x * 31 + y * 17) % 7;
          if (seed < 3) {
            ctx.fillRect(x * ts + 3, y * ts + 4, 1, 3);
            ctx.fillRect(x * ts + 9, y * ts + 8, 1, 3);
          }
          if (seed < 5) {
            ctx.fillRect(x * ts + 12, y * ts + 3, 1, 2);
          }
        } else if (tile === TILE_WALL || tile === TILE_DUNGEON_WALL) {
          // Brick pattern
          ctx.strokeStyle = tile === TILE_WALL ? '#666666' : '#222244';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
          // Horizontal line
          ctx.beginPath();
          ctx.moveTo(x * ts, y * ts + ts / 2);
          ctx.lineTo(x * ts + ts, y * ts + ts / 2);
          ctx.stroke();
          // Vertical offset bricks
          ctx.beginPath();
          ctx.moveTo(x * ts + ts / 2, y * ts);
          ctx.lineTo(x * ts + ts / 2, y * ts + ts / 2);
          ctx.stroke();
        } else if (tile === TILE_WATER) {
          // Water animation
          const wave = Math.sin((this.animFrame * 0.05) + x + y * 0.5) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(100, 150, 255, ${0.1 + wave * 0.15})`;
          ctx.fillRect(x * ts + 2, y * ts + 2, ts - 4, ts - 4);
        } else if (tile === TILE_TREE) {
          // Tree trunk and canopy
          ctx.fillStyle = '#4A3728';
          ctx.fillRect(x * ts + 6, y * ts + 8, 4, 8);
          ctx.fillStyle = '#2E7D32';
          ctx.beginPath();
          ctx.arc(x * ts + 8, y * ts + 6, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === TILE_DUNGEON_FLOOR) {
          // Dungeon floor pattern
          ctx.strokeStyle = '#444460';
          ctx.lineWidth = 0.3;
          ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
        } else if (tile === TILE_SAND) {
          // Sand dots
          ctx.fillStyle = '#B8A870';
          const seed = (x * 13 + y * 7) % 5;
          if (seed < 2) {
            ctx.fillRect(x * ts + 4, y * ts + 6, 1, 1);
            ctx.fillRect(x * ts + 10, y * ts + 3, 1, 1);
          }
        }
      }
    }
  }

  private drawDoors(
    ctx: CanvasRenderingContext2D, world: World,
    map: RoomMapData, gameState: GameStateData,
  ): void {
    const doors = world.query(query(Position, Door));
    const ts = map.tileSize;

    for (const eid of doors) {
      const x = Position.x[eid];
      const y = Position.y[eid];
      const lockType = Door.lockType[eid];

      if (lockType === 0) {
        // Open door - draw as slightly brighter tile
        ctx.fillStyle = 'rgba(255, 255, 200, 0.1)';
        ctx.fillRect(x - ts / 2, y - ts / 2, ts, ts);
      } else if (lockType === 1) {
        // Locked door
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(x - 6, y - 6, 12, 12);
        // Keyhole
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 1, y - 2, 2, 4);
        ctx.beginPath();
        ctx.arc(x, y - 3, 2, 0, Math.PI * 2);
        ctx.fill();
        // Glow if player has key
        if (gameState.keys > 0) {
          ctx.strokeStyle = 'rgba(255, 221, 0, 0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 7, y - 7, 14, 14);
        }
      }
    }
  }

  private drawItems(ctx: CanvasRenderingContext2D, world: World): void {
    const items = world.query(query(Position, Item, Renderable).not(Dead));
    const bob = Math.sin(this.animFrame * 0.08) * 1.5;

    for (const eid of items) {
      const x = Position.x[eid];
      const y = Position.y[eid] + bob;
      const w = Renderable.width[eid];
      const h = Renderable.height[eid];
      const color = Renderable.color[eid];
      const shape = Renderable.shape[eid];
      const itemType = Item.itemType[eid];

      ctx.fillStyle = colorToCSS(color);

      if (itemType === ITEM_HEART) {
        // Heart shape (simplified)
        this.drawHeart(ctx, x, y, w / 2);
      } else if (itemType === ITEM_KEY) {
        // Key
        ctx.fillRect(x - 1, y - h / 2, 2, h);
        ctx.fillRect(x - 3, y - h / 2, 6, 3);
        ctx.fillRect(x - 2, y + h / 4, 4, 2);
      } else if (itemType === ITEM_TRIFORCE) {
        // Triangle
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x - w / 2, y + h / 2);
        ctx.closePath();
        ctx.fill();
        // Glow
        ctx.strokeStyle = colorToAlpha(color, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (shape === 4) {
        // Diamond
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x - w / 2, y);
        ctx.closePath();
        ctx.fill();
      } else if (shape === 1) {
        // Circle
        ctx.beginPath();
        ctx.arc(x, y, w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
      }
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y + s);
    ctx.bezierCurveTo(x - s * 2, y - s * 0.5, x - s * 0.5, y - s * 2, x, y - s * 0.8);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 2, x + s * 2, y - s * 0.5, x, y + s);
    ctx.fill();
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, world: World): void {
    const enemies = world.query(query(Position, Enemy, Health, Renderable).not(Dead));

    for (const eid of enemies) {
      const x = Position.x[eid];
      const y = Position.y[eid];
      const w = Renderable.width[eid];
      const h = Renderable.height[eid];
      const color = Renderable.color[eid];
      const enemyType = Enemy.enemyType[eid];
      const hp = Health.current[eid];
      const maxHp = Health.max[eid];

      // Body
      ctx.fillStyle = colorToCSS(color);

      if (enemyType === 3) {
        // Keese (bat) - wing flap animation
        const flap = Math.sin(this.animFrame * 0.3) * 3;
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x - w / 2 - 2, y - flap);
        ctx.lineTo(x - w / 4, y + 2);
        ctx.lineTo(x + w / 4, y + 2);
        ctx.lineTo(x + w / 2 + 2, y - flap);
        ctx.closePath();
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x - 2, y - 2, 1.5, 1.5);
        ctx.fillRect(x + 1, y - 2, 1.5, 1.5);
      } else if (enemyType === 4) {
        // Gel (slime) - blobby
        const squish = Math.sin(this.animFrame * 0.1) * 1;
        ctx.beginPath();
        ctx.ellipse(x, y + squish * 0.5, w / 2, h / 2 - squish, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(x - 1, y - 2, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemyType === 2) {
        // Darknut - armored square
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        // Armor highlights
        ctx.strokeStyle = '#5555CC';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
        // Visor
        ctx.fillStyle = '#CC0000';
        ctx.fillRect(x - 3, y - 2, 6, 2);
      } else if (enemyType === 1) {
        // Moblin
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        // Face
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 3, y - 3, 2, 2);
        ctx.fillRect(x + 1, y - 3, 2, 2);
        // Snout
        ctx.fillStyle = '#AA5533';
        ctx.fillRect(x - 2, y, 4, 3);
      } else {
        // Octorok - rounded
        ctx.beginPath();
        ctx.arc(x, y, w / 2, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 3, y - 3, 2, 2);
        ctx.fillRect(x + 1, y - 3, 2, 2);
      }

      // Health bar (only if damaged)
      if (hp < maxHp) {
        const barW = w + 4;
        const barH = 2;
        const barX = x - barW / 2;
        const barY = y - h / 2 - 5;
        const pct = Math.max(0, hp / maxHp);

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FFC107' : '#F44336';
        ctx.fillRect(barX, barY, barW * pct, barH);
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, world: World): void {
    const players = world.query(query(Position, Player, Health).not(Dead));
    if (players.length === 0) return;
    const eid = players[0];

    const x = Position.x[eid];
    const y = Position.y[eid];
    const facing = Player.facing[eid];
    const invincible = Player.invincibleTimer[eid] > 0;

    // Blink when invincible
    if (invincible && Math.floor(this.animFrame / 3) % 2 === 0) return;

    // Body (green tunic)
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x - 6, y - 6, 12, 12);

    // Skin
    ctx.fillStyle = '#FFCC88';

    // Face based on direction
    if (facing === 0) {
      // Down - face visible
      ctx.fillRect(x - 4, y - 5, 8, 5);
      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 3, y - 4, 2, 2);
      ctx.fillRect(x + 1, y - 4, 2, 2);
    } else if (facing === 1) {
      // Up - back of head
      ctx.fillRect(x - 4, y - 6, 8, 4);
      // Hair
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(x - 4, y - 7, 8, 3);
    } else if (facing === 2) {
      // Left - side view
      ctx.fillRect(x - 5, y - 5, 5, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 4, y - 4, 2, 2);
    } else {
      // Right - side view
      ctx.fillRect(x, y - 5, 5, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 2, y - 4, 2, 2);
    }

    // Hat
    ctx.fillStyle = '#388E3C';
    if (facing === 2) {
      ctx.fillRect(x - 6, y - 7, 6, 3);
      ctx.fillRect(x - 8, y - 6, 3, 2);
    } else if (facing === 3) {
      ctx.fillRect(x, y - 7, 6, 3);
      ctx.fillRect(x + 5, y - 6, 3, 2);
    } else {
      ctx.fillRect(x - 5, y - 7, 10, 3);
    }

    // Belt
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x - 5, y + 1, 10, 2);
  }

  private drawSwords(ctx: CanvasRenderingContext2D, world: World): void {
    const swords = world.query(query(Position, Sword, Renderable));

    for (const eid of swords) {
      const x = Position.x[eid];
      const y = Position.y[eid];
      const w = Renderable.width[eid];
      const h = Renderable.height[eid];

      // Blade
      ctx.fillStyle = '#CCCCEE';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);

      // Glow
      ctx.strokeStyle = 'rgba(180, 180, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2 - 0.5, y - h / 2 - 0.5, w + 1, h + 1);
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, world: World): void {
    const projectiles = world.query(query(Position, Projectile, Renderable));

    for (const eid of projectiles) {
      const x = Position.x[eid];
      const y = Position.y[eid];
      const w = Renderable.width[eid];
      const color = Renderable.color[eid];

      ctx.fillStyle = colorToCSS(color);
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHUD(
    ctx: CanvasRenderingContext2D, map: RoomMapData,
    gameState: GameStateData, s: number, hudHeight: number,
  ): void {
    const world = this.world;
    const gameW = map.roomWidth * map.tileSize;

    ctx.save();
    ctx.scale(s, s);

    // HUD background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, gameW, hudHeight);

    // Separator line
    ctx.fillStyle = '#333';
    ctx.fillRect(0, hudHeight - 1, gameW, 1);

    // Hearts
    const players = world.query(query(Player, Health).not(Dead));
    if (players.length > 0) {
      const pEid = players[0];
      const hp = Health.current[pEid];
      const maxHp = Health.max[pEid];

      ctx.font = '8px monospace';
      ctx.textBaseline = 'middle';

      // Draw hearts
      for (let i = 0; i < maxHp; i++) {
        const hx = 4 + i * 10;
        const hy = 8;
        if (i < hp) {
          ctx.fillStyle = '#FF3366';
        } else {
          ctx.fillStyle = '#333';
        }
        this.drawHeart(ctx, hx, hy, 5);
      }

      // Keys
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'left';
      ctx.fillText(`KEY:${gameState.keys}`, 4 + maxHp * 10 + 6, 12);

      // Rupees
      ctx.fillStyle = '#33CC33';
      ctx.fillText(`GEM:${gameState.rupees}`, 4 + maxHp * 10 + 48, 12);
    }

    // Room name
    const room = map.rooms[gameState.currentRoom];
    if (room) {
      ctx.fillStyle = '#888';
      ctx.font = '7px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(room.name, gameW - 4, 8);
    }

    // Triforce progress
    if (gameState.triforceShards > 0) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '7px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`TRI:${gameState.triforceShards}/${gameState.totalTriforceShards}`, gameW - 4, 18);
    }

    // Minimap
    this.drawMinimap(ctx, gameW, gameState);

    ctx.restore();
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D, gameW: number,
    gameState: GameStateData,
  ): void {
    const mapX = gameW / 2 - 16;
    const mapY = 3;
    const cellW = 8;
    const cellH = 5;

    // Map grid layout (3 columns x 4 rows based on room connections)
    const layout: (number | -1)[][] = [
      [0,  1,  2],
      [3,  4, -1],
      [5,  6, -1],
      [-1, 7, -1],
    ];

    for (let row = 0; row < layout.length; row++) {
      for (let col = 0; col < layout[row].length; col++) {
        const roomIdx = layout[row][col];
        if (roomIdx === -1) continue;

        const rx = mapX + col * (cellW + 1);
        const ry = mapY + row * (cellH + 1);

        if (gameState.visitedRooms.has(roomIdx)) {
          if (roomIdx === gameState.currentRoom) {
            ctx.fillStyle = '#4CAF50';
          } else if (gameState.clearedRooms.has(roomIdx)) {
            ctx.fillStyle = '#444';
          } else {
            ctx.fillStyle = '#666';
          }
          ctx.fillRect(rx, ry, cellW, cellH);
        } else {
          ctx.fillStyle = '#222';
          ctx.fillRect(rx, ry, cellW, cellH);
        }
      }
    }
  }

  private drawOverlay(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    title: string, color: string, subtitle: string,
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = color;
    ctx.font = 'bold 36px monospace';
    ctx.fillText(title, w / 2, h / 2 - 20);

    ctx.fillStyle = '#ccc';
    ctx.font = '16px monospace';
    ctx.fillText(subtitle, w / 2, h / 2 + 20);

    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText('Press R to restart', w / 2, h / 2 + 50);
  }

  private drawTitleScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('ADLEZ', w / 2, h / 3);

    // Subtitle
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('A HyperNova Adventure', w / 2, h / 3 + 40);

    // Triforce decoration
    const triY = h / 2 + 20;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(w / 2, triY - 20);
    ctx.lineTo(w / 2 + 20, triY + 15);
    ctx.lineTo(w / 2 - 20, triY + 15);
    ctx.closePath();
    ctx.fill();

    // Prompt
    const blink = Math.sin(this.animFrame * 0.06) > 0;
    if (blink) {
      ctx.fillStyle = '#ccc';
      ctx.font = '16px monospace';
      ctx.fillText('Press SPACE to start', w / 2, h * 0.75);
    }
  }
}
