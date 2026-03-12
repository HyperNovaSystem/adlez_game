import { defineComponent, Types, defineEvent, defineResource } from '@nova/core';
import type { ResourceToken, EventToken } from '@nova/core';

// ─── Core spatial components ───

export const Position = defineComponent('Position', {
  x: Types.f32,
  y: Types.f32,
});

export const Velocity = defineComponent('Velocity', {
  x: Types.f32,
  y: Types.f32,
});

// ─── Player components ───

export const Player = defineComponent('Player', {
  /** Facing direction: 0=down, 1=up, 2=left, 3=right */
  facing: Types.u8,
  /** Movement speed in pixels/sec */
  speed: Types.f32,
  /** Invincibility frames remaining (seconds) */
  invincibleTimer: Types.f32,
  /** Attack cooldown remaining (seconds) */
  attackCooldown: Types.f32,
});

export const Health = defineComponent('Health', {
  current: Types.f32,
  max: Types.f32,
});

// ─── Enemy components ───

export const Enemy = defineComponent('Enemy', {
  /** 0=octorok, 1=moblin, 2=darknut, 3=keese (bat), 4=gel (slime) */
  enemyType: Types.u8,
  /** Movement speed */
  speed: Types.f32,
  /** AI state: 0=idle, 1=wander, 2=chase, 3=attack, 4=stunned */
  aiState: Types.u8,
  /** Timer for current AI state (seconds) */
  aiTimer: Types.f32,
  /** Direction of movement: 0=down, 1=up, 2=left, 3=right */
  moveDir: Types.u8,
  /** Detection range for player (pixels) */
  detectRange: Types.f32,
  /** Damage dealt on contact */
  damage: Types.f32,
});

// ─── Sword / attack components ───

export const Sword = defineComponent('Sword', {
  /** Damage dealt */
  damage: Types.f32,
  /** Time remaining for the sword hitbox (seconds) */
  lifetime: Types.f32,
  /** Owner entity (the player) */
  owner: Types.u32,
});

export const Projectile = defineComponent('Projectile', {
  /** Direction: 0=down, 1=up, 2=left, 3=right */
  direction: Types.u8,
  speed: Types.f32,
  damage: Types.f32,
  /** Time remaining before despawn */
  lifetime: Types.f32,
  /** Owner entity */
  owner: Types.u32,
});

// ─── Collectible / item components ───

export const Item = defineComponent('Item', {
  /** 0=heart, 1=key, 2=rupee, 3=triforce_shard, 4=bomb, 5=boomerang */
  itemType: Types.u8,
  /** Value (health restored, rupee amount, etc.) */
  value: Types.f32,
});

// ─── World objects ───

export const Door = defineComponent('Door', {
  /** Target room index */
  targetRoom: Types.u16,
  /** Spawn X in target room (tile coords) */
  targetX: Types.u8,
  /** Spawn Y in target room (tile coords) */
  targetY: Types.u8,
  /** 0=open, 1=locked (needs key), 2=boss door */
  lockType: Types.u8,
  /** Direction the door faces: 0=down, 1=up, 2=left, 3=right */
  direction: Types.u8,
});

export const Solid = defineComponent('Solid', {
  /** Half-width of collision box */
  halfW: Types.f32,
  /** Half-height of collision box */
  halfH: Types.f32,
});

export const Pushable = defineComponent('Pushable', {});

// ─── Visual components ───

export const Renderable = defineComponent('Renderable', {
  /** Width in pixels */
  width: Types.f32,
  /** Height in pixels */
  height: Types.f32,
  /** Color packed as 0xRRGGBB */
  color: Types.u32,
  /** Shape: 0=rect, 1=circle, 2=triangle_down, 3=triangle_up, 4=diamond */
  shape: Types.u8,
});

export const AnimationState = defineComponent('AnimationState', {
  /** Current animation frame index */
  frame: Types.u8,
  /** Timer for frame advancement */
  timer: Types.f32,
  /** Frames per second */
  fps: Types.f32,
  /** Total frame count */
  frameCount: Types.u8,
});

// ─── Tag components ───

export const Dead = defineComponent('Dead', {});
export const Invincible = defineComponent('Invincible', {});

// ─── Resources ───

export interface GameStateData {
  /** Current room index */
  currentRoom: number;
  /** Player keys collected */
  keys: number;
  /** Player rupees */
  rupees: number;
  /** Triforce shards collected */
  triforceShards: number;
  /** Total triforce shards to win */
  totalTriforceShards: number;
  /** Bombs available */
  bombs: number;
  /** Has boomerang */
  hasBoomerang: boolean;
  /** Game phase: 'playing' | 'transition' | 'gameover' | 'victory' */
  phase: 'playing' | 'transition' | 'gameover' | 'victory' | 'title';
  /** Transition timer for room changes */
  transitionTimer: number;
  /** Transition direction for room scrolling */
  transitionDir: number;
  /** Target room during transition */
  transitionTargetRoom: number;
  /** Target player X during transition */
  transitionTargetX: number;
  /** Target player Y during transition */
  transitionTargetY: number;
  /** Rooms that have been cleared (enemy-free) */
  clearedRooms: Set<number>;
  /** Rooms that have been visited */
  visitedRooms: Set<number>;
}

export const GameState: ResourceToken<GameStateData> = defineResource<GameStateData>('GameState');

export interface InputData {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  interact: boolean;
  /** Attack was just pressed this frame */
  attackPressed: boolean;
  /** Interact was just pressed this frame */
  interactPressed: boolean;
}

export const InputState: ResourceToken<InputData> = defineResource<InputData>('InputState');

export interface RoomMapData {
  /** Tile width in pixels */
  tileSize: number;
  /** Room width in tiles */
  roomWidth: number;
  /** Room height in tiles */
  roomHeight: number;
  /** The room data array (populated per room load) */
  tiles: Uint8Array;
  /** All room definitions */
  rooms: RoomDef[];
}

export interface RoomDef {
  name: string;
  tiles: number[];
  enemies: EnemySpawn[];
  items: ItemSpawn[];
  doors: DoorSpawn[];
}

export interface EnemySpawn {
  type: number;
  tileX: number;
  tileY: number;
}

export interface ItemSpawn {
  type: number;
  tileX: number;
  tileY: number;
  value: number;
}

export interface DoorSpawn {
  tileX: number;
  tileY: number;
  targetRoom: number;
  targetX: number;
  targetY: number;
  lockType: number;
  direction: number;
}

export const RoomMap: ResourceToken<RoomMapData> = defineResource<RoomMapData>('RoomMap');

// ─── Events ───

export interface DamageEventData {
  target: number;
  amount: number;
  source: number;
}

export const DamageEvent: EventToken<DamageEventData> = defineEvent<DamageEventData>('DamageEvent');

export interface ItemPickupData {
  itemType: number;
  value: number;
}

export const ItemPickup: EventToken<ItemPickupData> = defineEvent<ItemPickupData>('ItemPickup');

export interface RoomTransitionData {
  fromRoom: number;
  toRoom: number;
  direction: number;
}

export const RoomTransition: EventToken<RoomTransitionData> = defineEvent<RoomTransitionData>('RoomTransition');

export interface EnemyDefeatedData {
  enemyType: number;
  x: number;
  y: number;
}

export const EnemyDefeated: EventToken<EnemyDefeatedData> = defineEvent<EnemyDefeatedData>('EnemyDefeated');

// ─── Tile types ───

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_WATER = 2;
export const TILE_TREE = 3;
export const TILE_SAND = 4;
export const TILE_GRASS = 5;
export const TILE_BRIDGE = 6;
export const TILE_STAIRS = 7;
export const TILE_CHEST = 8;
export const TILE_DUNGEON_FLOOR = 9;
export const TILE_DUNGEON_WALL = 10;

// ─── Enemy type definitions ───

export interface EnemyDef {
  name: string;
  health: number;
  speed: number;
  damage: number;
  color: number;
  detectRange: number;
  width: number;
  height: number;
}

export const ENEMY_DEFS: EnemyDef[] = [
  // 0: Octorok - wanders and shoots rocks
  { name: 'Octorok', health: 2, speed: 40, damage: 1, color: 0xCC3333, detectRange: 100, width: 14, height: 14 },
  // 1: Moblin - charges at player
  { name: 'Moblin', health: 3, speed: 50, damage: 1, color: 0xCC6633, detectRange: 120, width: 14, height: 16 },
  // 2: Darknut - armored, patrols
  { name: 'Darknut', health: 6, speed: 30, damage: 2, color: 0x333399, detectRange: 80, width: 14, height: 16 },
  // 3: Keese - bat, erratic movement
  { name: 'Keese', health: 1, speed: 70, damage: 1, color: 0x663366, detectRange: 150, width: 12, height: 10 },
  // 4: Gel - slime, slow
  { name: 'Gel', health: 1, speed: 25, damage: 1, color: 0x33CC66, detectRange: 60, width: 10, height: 10 },
];

// ─── Item type names ───

export const ITEM_HEART = 0;
export const ITEM_KEY = 1;
export const ITEM_RUPEE = 2;
export const ITEM_TRIFORCE = 3;
export const ITEM_BOMB = 4;
export const ITEM_BOOMERANG = 5;
