import type { RoomMapData, RoomDef } from './components.js';
import {
  TILE_FLOOR, TILE_WALL, TILE_WATER, TILE_TREE,
  TILE_SAND, TILE_GRASS, TILE_DUNGEON_FLOOR, TILE_DUNGEON_WALL,
  ITEM_HEART, ITEM_KEY, ITEM_RUPEE, ITEM_TRIFORCE,
} from './components.js';

const W = TILE_WALL;
const F = TILE_FLOOR;
const G = TILE_GRASS;
const T = TILE_TREE;
const S = TILE_SAND;
const A = TILE_WATER;
const D = TILE_DUNGEON_FLOOR;
const X = TILE_DUNGEON_WALL;

/**
 * Build the game world as a set of interconnected rooms.
 * Each room is 16x11 tiles (256x176 px at 16px tile size).
 *
 * Layout (overworld):
 *   [0: Start]  --right-- [1: Field] --right-- [2: Lake]
 *       |down                  |down
 *   [3: Forest]           [4: Dungeon Entry]
 *       |down                  |down
 *   [5: Ruins]            [6: Dungeon 1]
 *                              |down
 *                          [7: Dungeon 2 / Boss]
 */
export function createRoomMap(): RoomMapData {
  const tileSize = 16;
  const roomWidth = 16;
  const roomHeight = 11;

  const rooms: RoomDef[] = [
    createRoom0_Start(),
    createRoom1_Field(),
    createRoom2_Lake(),
    createRoom3_Forest(),
    createRoom4_DungeonEntry(),
    createRoom5_Ruins(),
    createRoom6_Dungeon1(),
    createRoom7_DungeonBoss(),
  ];

  const tiles = new Uint8Array(roomWidth * roomHeight);

  return { tileSize, roomWidth, roomHeight, tiles, rooms };
}

// ─── Room 0: Starting Meadow ───
function createRoom0_Start(): RoomDef {
  return {
    name: 'Starting Meadow',
    tiles: [
      T,T,T,T,T,T,T,G,G,T,T,T,T,T,T,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G, // right exit row
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,T,T,T,T,T,T,G,G,T,T,T,T,T,T,T, // bottom exit
    ],
    enemies: [
      { type: 4, tileX: 4, tileY: 4 },  // gel
      { type: 4, tileX: 11, tileY: 6 },  // gel
    ],
    items: [
      { type: ITEM_RUPEE, tileX: 8, tileY: 3, value: 1 },
    ],
    doors: [
      // Right exit -> Room 1
      { tileX: 15, tileY: 2, targetRoom: 1, targetX: 1, targetY: 2, lockType: 0, direction: 3 },
      // Bottom exit -> Room 3
      { tileX: 7, tileY: 10, targetRoom: 3, targetX: 7, targetY: 1, lockType: 0, direction: 0 },
    ],
  };
}

// ─── Room 1: Open Field ───
function createRoom1_Field(): RoomDef {
  return {
    name: 'Open Field',
    tiles: [
      T,T,T,T,T,T,T,G,G,T,T,T,T,T,T,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      G,G,G,G,G,S,S,G,G,S,S,G,G,G,G,G, // left/right exits
      T,G,G,G,S,S,S,S,S,S,S,S,G,G,G,T,
      T,G,G,G,S,S,S,G,G,S,S,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,T,T,T,T,T,T,G,G,T,T,T,T,T,T,T, // bottom exit
    ],
    enemies: [
      { type: 0, tileX: 5, tileY: 6 },   // octorok
      { type: 0, tileX: 10, tileY: 7 },   // octorok
      { type: 3, tileX: 8, tileY: 3 },    // keese
    ],
    items: [
      { type: ITEM_RUPEE, tileX: 7, tileY: 4, value: 5 },
    ],
    doors: [
      // Left exit -> Room 0
      { tileX: 0, tileY: 2, targetRoom: 0, targetX: 14, targetY: 2, lockType: 0, direction: 2 },
      // Right exit -> Room 2
      { tileX: 15, tileY: 2, targetRoom: 2, targetX: 1, targetY: 5, lockType: 0, direction: 3 },
      // Bottom exit -> Room 4
      { tileX: 7, tileY: 10, targetRoom: 4, targetX: 7, targetY: 1, lockType: 0, direction: 0 },
    ],
  };
}

// ─── Room 2: Lakeside ───
function createRoom2_Lake(): RoomDef {
  return {
    name: 'Lakeside',
    tiles: [
      T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,A,A,A,A,A,A,A,A,G,G,G,T,
      T,G,G,A,A,A,A,A,A,A,A,A,A,G,G,T,
      T,G,G,A,A,A,A,A,A,A,A,A,A,G,G,T,
      G,G,G,G,A,A,A,A,A,A,A,A,G,G,G,T, // left exit
      T,G,G,G,A,A,A,A,A,A,A,A,G,G,G,T,
      T,G,G,G,G,A,A,A,A,A,A,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,
    ],
    enemies: [
      { type: 3, tileX: 2, tileY: 2 },   // keese
      { type: 3, tileX: 13, tileY: 8 },   // keese
    ],
    items: [
      { type: ITEM_HEART, tileX: 13, tileY: 1, value: 2 },
      { type: ITEM_RUPEE, tileX: 1, tileY: 9, value: 5 },
    ],
    doors: [
      // Left exit -> Room 1
      { tileX: 0, tileY: 5, targetRoom: 1, targetX: 14, targetY: 2, lockType: 0, direction: 2 },
    ],
  };
}

// ─── Room 3: Dark Forest ───
function createRoom3_Forest(): RoomDef {
  return {
    name: 'Dark Forest',
    tiles: [
      T,T,T,T,T,T,T,G,G,T,T,T,T,T,T,T, // top exit
      T,G,G,T,G,G,G,G,G,G,G,T,G,G,G,T,
      T,G,G,T,G,T,G,G,G,T,G,G,G,G,G,T,
      T,G,G,G,G,T,T,G,G,T,T,G,G,G,G,T,
      T,G,T,G,G,G,G,G,G,G,G,G,T,G,G,T,
      T,G,T,G,G,G,G,G,G,G,G,G,T,G,G,T,
      T,G,G,G,G,T,G,G,G,G,T,G,G,G,G,T,
      T,G,G,G,T,T,G,G,G,G,T,T,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,G,G,G,G,G,G,G,G,G,G,G,G,G,G,T,
      T,T,T,T,T,T,T,G,G,T,T,T,T,T,T,T, // bottom exit
    ],
    enemies: [
      { type: 1, tileX: 3, tileY: 5 },   // moblin
      { type: 1, tileX: 12, tileY: 3 },   // moblin
      { type: 4, tileX: 8, tileY: 7 },    // gel
      { type: 3, tileX: 6, tileY: 2 },    // keese
    ],
    items: [
      { type: ITEM_KEY, tileX: 7, tileY: 5, value: 1 },
    ],
    doors: [
      // Top exit -> Room 0
      { tileX: 7, tileY: 0, targetRoom: 0, targetX: 7, targetY: 9, lockType: 0, direction: 1 },
      // Bottom exit -> Room 5
      { tileX: 7, tileY: 10, targetRoom: 5, targetX: 7, targetY: 1, lockType: 0, direction: 0 },
    ],
  };
}

// ─── Room 4: Dungeon Entry ───
function createRoom4_DungeonEntry(): RoomDef {
  return {
    name: 'Dungeon Entrance',
    tiles: [
      W,W,W,W,W,W,W,G,G,W,W,W,W,W,W,W, // top exit
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,G,G,W,W,G,G,G,G,G,G,W,W,G,G,W,
      W,G,G,W,W,G,G,G,G,G,G,W,W,G,G,W,
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,G,G,G,G,G,G,G,G,G,G,G,G,G,G,W,
      W,W,W,W,W,W,W,G,G,W,W,W,W,W,W,W, // bottom exit (locked)
    ],
    enemies: [
      { type: 0, tileX: 3, tileY: 6 },
      { type: 0, tileX: 12, tileY: 2 },
      { type: 4, tileX: 7, tileY: 8 },
    ],
    items: [
      { type: ITEM_RUPEE, tileX: 2, tileY: 1, value: 5 },
    ],
    doors: [
      // Top exit -> Room 1
      { tileX: 7, tileY: 0, targetRoom: 1, targetX: 7, targetY: 9, lockType: 0, direction: 1 },
      // Bottom exit -> Room 6 (locked)
      { tileX: 7, tileY: 10, targetRoom: 6, targetX: 7, targetY: 1, lockType: 1, direction: 0 },
    ],
  };
}

// ─── Room 5: Ancient Ruins ───
function createRoom5_Ruins(): RoomDef {
  return {
    name: 'Ancient Ruins',
    tiles: [
      W,W,W,W,W,W,W,G,G,W,W,W,W,W,W,W, // top exit
      W,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,
      W,S,W,S,S,W,S,S,S,S,W,S,S,W,S,W,
      W,S,W,S,S,W,S,S,S,S,W,S,S,W,S,W,
      W,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,
      W,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,
      W,S,W,W,S,S,S,S,S,S,S,S,W,W,S,W,
      W,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,
      W,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,
      W,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,
      W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,
    ],
    enemies: [
      { type: 2, tileX: 4, tileY: 5 },   // darknut
      { type: 2, tileX: 11, tileY: 5 },   // darknut
      { type: 4, tileX: 7, tileY: 8 },    // gel
    ],
    items: [
      { type: ITEM_HEART, tileX: 7, tileY: 5, value: 2 },
      { type: ITEM_RUPEE, tileX: 1, tileY: 9, value: 10 },
    ],
    doors: [
      // Top exit -> Room 3
      { tileX: 7, tileY: 0, targetRoom: 3, targetX: 7, targetY: 9, lockType: 0, direction: 1 },
    ],
  };
}

// ─── Room 6: Dungeon Room 1 ───
function createRoom6_Dungeon1(): RoomDef {
  return {
    name: 'Dungeon - Hall',
    tiles: [
      X,X,X,X,X,X,X,D,D,X,X,X,X,X,X,X, // top exit
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,X,X,D,D,D,D,D,D,X,X,D,D,X,
      X,D,D,X,D,D,D,D,D,D,D,D,X,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,X,D,D,D,D,D,D,D,D,X,D,D,X,
      X,D,D,X,X,D,D,D,D,D,D,X,X,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,X,X,X,X,X,X,D,D,X,X,X,X,X,X,X, // bottom exit
    ],
    enemies: [
      { type: 2, tileX: 4, tileY: 2 },   // darknut
      { type: 2, tileX: 11, tileY: 8 },   // darknut
      { type: 1, tileX: 7, tileY: 5 },    // moblin
      { type: 3, tileX: 3, tileY: 7 },    // keese
      { type: 3, tileX: 12, tileY: 3 },   // keese
    ],
    items: [
      { type: ITEM_KEY, tileX: 7, tileY: 5, value: 1 },
    ],
    doors: [
      // Top exit -> Room 4
      { tileX: 7, tileY: 0, targetRoom: 4, targetX: 7, targetY: 9, lockType: 0, direction: 1 },
      // Bottom exit -> Room 7 (boss door)
      { tileX: 7, tileY: 10, targetRoom: 7, targetX: 7, targetY: 1, lockType: 1, direction: 0 },
    ],
  };
}

// ─── Room 7: Dungeon Boss Room ───
function createRoom7_DungeonBoss(): RoomDef {
  return {
    name: 'Dungeon - Boss Chamber',
    tiles: [
      X,X,X,X,X,X,X,D,D,X,X,X,X,X,X,X, // top exit
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,D,D,D,D,D,D,D,D,D,D,D,D,D,D,X,
      X,X,X,X,X,X,X,X,X,X,X,X,X,X,X,X,
    ],
    enemies: [
      // Boss: 3 darknuts + 2 moblins
      { type: 2, tileX: 7, tileY: 4 },
      { type: 2, tileX: 4, tileY: 6 },
      { type: 2, tileX: 10, tileY: 6 },
      { type: 1, tileX: 3, tileY: 3 },
      { type: 1, tileX: 12, tileY: 3 },
    ],
    items: [
      // Triforce shard drops after clearing room
      { type: ITEM_TRIFORCE, tileX: 7, tileY: 5, value: 1 },
    ],
    doors: [
      // Top exit -> Room 6
      { tileX: 7, tileY: 0, targetRoom: 6, targetX: 7, targetY: 9, lockType: 0, direction: 1 },
    ],
  };
}

/**
 * Check if a tile is solid (blocks movement).
 */
export function isTileSolid(tileType: number): boolean {
  return tileType === TILE_WALL
    || tileType === TILE_TREE
    || tileType === TILE_WATER
    || tileType === TILE_DUNGEON_WALL;
}

/**
 * Load room tile data into the map resource.
 */
export function loadRoom(map: RoomMapData, roomIndex: number): void {
  const room = map.rooms[roomIndex];
  for (let i = 0; i < room.tiles.length; i++) {
    map.tiles[i] = room.tiles[i];
  }
}
