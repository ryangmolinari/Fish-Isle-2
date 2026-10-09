// Configuração central de balanceamento e rede. Altere aqui para rebalancear.

export const TILE = 32;
export const MAP_W = 96; // em tiles
export const MAP_H = 72;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

export const MAX_PLAYERS_PER_ROOM = 12;
export const SERVER_TICK_HZ = 15;          // envio de snapshots
export const CLIENT_SEND_HZ = 15;          // envio de posição pelo cliente
export const RECONNECT_GRACE_MS = 45_000;  // vaga reservada após desconexão
export const PROFILE_KEEP_MS = 30 * 60_000; // perfil guardado na sala (reconexão tardia)

export const WALK_SPEED = 120;   // px/s
export const BOAT_MAX_SPEED = 230;
export const BOAT_ACCEL = 180;
export const BOAT_DRAG = 1.4;
export const BOAT_TURN = 2.6;    // rad/s

export const START_COINS = 60;
export const START_CAPACITY = 20;
export const CAPACITY_STEP = 10;
export const CAPACITY_MAX = 80;

// Raridades — probabilidades por categoria (configuráveis).
export const RARITIES = {
  common:    { id: 'common',    label: 'Comum',    symbol: '●',  stars: 1, color: '#8fb3a0', chance: 0.55 },
  uncommon:  { id: 'uncommon',  label: 'Incomum',  symbol: '◆',  stars: 2, color: '#5aa8e0', chance: 0.28 },
  rare:      { id: 'rare',      label: 'Rara',     symbol: '★',  stars: 3, color: '#c27be8', chance: 0.14 },
  legendary: { id: 'legendary', label: 'Lendária', symbol: '♛',  stars: 4, color: '#f2b53a', chance: 0.03 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];

// Pesca
export const FISHING = {
  minCastPower: 0.12,
  biteWaitMin: 2.5,       // s
  biteWaitMax: 9.0,
  hotspotWaitMult: 0.6,
  hotspotRareBonus: 0.25, // multiplica peso de incomum/rara (não lendária)
  reactionWindow: 1.5,    // s para fisgar após a mordida
  castFlightTime: 0.7,    // s de voo da boia
  minigameHz: 30,
  minigameMaxSeconds: 50,
  fightTimeoutSeconds: 70, // servidor desiste da luta (desconexão / cliente travado)
  maxFishingIdleSeconds: 120,
};

export const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
