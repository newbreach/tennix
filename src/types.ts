export type CourtSurface = 'hard' | 'clay' | 'grass';

export type GameDifficulty = 'easy' | 'medium' | 'hard';

export type ControlMode = 'touch' | 'joystick';

export type ShotType = 'flat' | 'topspin' | 'slice' | 'lob' | 'smash';

export type SwingDirection = 'tap' | 'up' | 'down' | 'left' | 'right';

export interface TechniqueFeedback {
  id: string;
  name: string; // e.g. "强力上旋"
  enName: string; // "Heavy Topspin"
  icon: string; // "⚡"
  color: string; // "#38bdf8"
  speedKmh: number;
  description: string;
}

export type GameState = 'idle' | 'serving' | 'rally' | 'point_ended' | 'game_over';

export interface ScoreState {
  playerPoints: number; // 0=0, 1=15, 2=30, 3=40, 4=AD
  aiPoints: number;
  playerGames: number;
  aiGames: number;
  playerSets: number;
  aiSets: number;
  isDeuce: boolean;
  server: 'player' | 'ai';
  currentServeSide: 'deuce' | 'ad'; // Right side = deuce, Left side = ad
  faultCount: number; // 0, 1 (first fault), 2 (double fault)
  history: string[]; // Match event log
}

export interface MatchStats {
  aces: { player: number; ai: number };
  doubleFaults: { player: number; ai: number };
  winners: { player: number; ai: number };
  totalPointsWon: { player: number; ai: number };
  longestRally: number;
  currentRally: number;
}

export interface PlayerEntity {
  x: number; // Court coordinates: -courtWidth/2 to courtWidth/2
  y: number; // Baseline distance: ~ -12 to 12
  z: number; // Jumping height
  vx: number;
  vy: number;
  facing: 1 | -1;
  isSwinging: boolean;
  swingProgress: number; // 0 to 1
  swingType: ShotType;
  stamina: number;
  color: string;
}

export interface BallEntity {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number; // topspin (>0) or slice (<0)
  lastHitBy: 'player' | 'ai' | null;
  bounces: number;
  bouncePos?: { x: number; y: number };
  inPlay: boolean;
  trail: Array<{ x: number; y: number; z: number; alpha: number }>;
}
