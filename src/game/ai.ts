import { BallEntity, GameDifficulty, PlayerEntity, ShotType } from '../types';
import { COURT_HALF_LENGTH, COURT_HALF_WIDTH, computeShotVelocity } from './physics';

export interface AIState {
  targetX: number;
  targetY: number;
  reactionTimer: number;
  serveTimer: number;
  predictedLandingX: number;
  preparedShot: ShotType;
}

export function createInitialAIState(): AIState {
  return {
    targetX: 0,
    targetY: -COURT_HALF_LENGTH,
    reactionTimer: 0,
    serveTimer: 0,
    predictedLandingX: 0,
    preparedShot: 'flat',
  };
}

export function updateAI(
  ai: PlayerEntity,
  aiState: AIState,
  ball: BallEntity,
  player: PlayerEntity,
  difficulty: GameDifficulty,
  dt: number,
  isServing: boolean,
  serveSide: 'deuce' | 'ad'
): { shouldServe: boolean; shouldSwing: boolean; shotParams?: { vx: number; vy: number; vz: number; spin: number; type: ShotType } } {
  // Speed parameters by difficulty
  let maxSpeed = 6.2; // m/s
  let errorChance = 0.15; // chance to hit sub-optimal or error shot
  let reactionDelay = 0.22; // seconds

  if (difficulty === 'easy') {
    maxSpeed = 4.8;
    errorChance = 0.25;
    reactionDelay = 0.35;
  } else if (difficulty === 'hard') {
    maxSpeed = 7.5;
    errorChance = 0.05;
    reactionDelay = 0.12;
  }

  // 1. Serving routine
  if (isServing) {
    aiState.serveTimer += dt;
    // Position AI at proper side of center mark
    const serveX = serveSide === 'deuce' ? 1.8 : -1.8;
    ai.x += (serveX - ai.x) * Math.min(1.0, 5 * dt);
    ai.y = -COURT_HALF_LENGTH - 0.2;

    // After brief preparation, trigger serve
    if (aiState.serveTimer >= 1.2) {
      aiState.serveTimer = 0;
      // Target player's service box diagonally
      // If serveSide is deuce, AI is on right (x > 0), targets player's right box (which is x < 0 from player perspective, i.e. x < 0)
      const targetSideX = serveSide === 'deuce' ? -1.8 : 1.8;
      const targetAimX = targetSideX + (Math.random() - 0.5) * 1.5;
      const targetAimY = 3.8 + Math.random() * 2.0;

      const shotType: ShotType = difficulty === 'hard' && Math.random() > 0.5 ? 'topspin' : 'flat';
      const shot = computeShotVelocity(ai.x, ai.y, targetAimX, targetAimY, shotType, 0.95);
      return { shouldServe: true, shouldSwing: true, shotParams: { ...shot, type: shotType } };
    }

    return { shouldServe: false, shouldSwing: false };
  }

  // 2. Normal Rally logic
  // Ball moving towards AI?
  const ballComingToAI = ball.inPlay && ball.vy < 0;

  if (ballComingToAI) {
    aiState.reactionTimer += dt;

    if (aiState.reactionTimer >= reactionDelay) {
      // Predict ball X when it reaches AI's Y level
      const timeToReach = Math.max(0.1, (ai.y - ball.y) / ball.vy);
      const predX = ball.x + ball.vx * timeToReach;
      // Clamp within court reachable boundaries
      aiState.predictedLandingX = Math.max(-COURT_HALF_WIDTH - 0.6, Math.min(COURT_HALF_WIDTH + 0.6, predX));
      aiState.targetX = aiState.predictedLandingX;

      // Depth positioning: if ball is short, move up!
      if (ball.y > -5.0 && ball.vz < 0 && ball.bounces > 0) {
        aiState.targetY = -3.5; // Approach net for volley/putaway
      } else {
        aiState.targetY = -COURT_HALF_LENGTH;
      }
    }
  } else {
    // Reset reaction timer and recover towards center baseline
    aiState.reactionTimer = 0;
    aiState.targetX = 0;
    aiState.targetY = -COURT_HALF_LENGTH;
  }

  // Move AI towards target
  const dx = aiState.targetX - ai.x;
  const dy = aiState.targetY - ai.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0.05) {
    const moveDist = Math.min(dist, maxSpeed * dt);
    ai.x += (dx / dist) * moveDist;
    ai.y += (dy / dist) * moveDist;
    ai.facing = dx >= 0 ? 1 : -1;
  }

  // 3. Swing detection when ball is in range
  if (ballComingToAI && ball.inPlay) {
    const distX = Math.abs(ball.x - ai.x);
    const distY = Math.abs(ball.y - ai.y);
    const heightZ = ball.z;

    // Strike zone: ball close in X and Y, and at reasonable height (0.2m to 2.4m)
    const inStrikeZone = distX < 1.4 && distY < 1.4 && heightZ >= 0.2 && heightZ <= 2.5;

    // Volley or after-bounce hit
    if (inStrikeZone && !ai.isSwinging) {
      // Decide shot type and placement
      let shotType: ShotType = 'flat';
      if (heightZ > 1.8 && ai.y > -8.0) {
        shotType = 'smash'; // High ball near net -> smash!
      } else if (difficulty !== 'easy' && Math.random() > 0.6) {
        shotType = 'topspin';
      } else if (Math.random() < 0.2) {
        shotType = 'slice';
      }

      // Choose target placement: aim into open court away from player
      let targetX = player.x > 0 ? -2.8 : 2.8;
      // Add slight variance / error
      targetX += (Math.random() - 0.5) * (errorChance * 6.0);
      let targetY = COURT_HALF_LENGTH - 1.2 - Math.random() * 2.0;

      // If smash, aim deeper with high speed
      if (shotType === 'smash') {
        targetY = COURT_HALF_LENGTH - 0.8;
      }

      const power = difficulty === 'hard' ? 1.05 : difficulty === 'medium' ? 0.95 : 0.82;
      const shot = computeShotVelocity(ai.x, ai.y, targetX, targetY, shotType, power);

      return {
        shouldServe: false,
        shouldSwing: true,
        shotParams: { ...shot, type: shotType },
      };
    }
  }

  return { shouldServe: false, shouldSwing: false };
}
