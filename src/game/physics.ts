import { BallEntity, CourtSurface, ShotType } from '../types';

export const COURT_HALF_LENGTH = 11.89; // meters from net to baseline
export const COURT_HALF_WIDTH = 4.115; // singles sideline
export const COURT_DOUBLES_HALF_WIDTH = 5.485; // doubles sideline
export const SERVICE_LINE_DIST = 6.4; // from net to service line
export const NET_HEIGHT_CENTER = 0.914; // net height at center
export const NET_HEIGHT_POST = 1.07; // net height at edges
export const GRAVITY = 15.0; // m/s^2 for dynamic fast paced arcade tennis

export interface TrajectoryResult {
  hitGround: boolean;
  bouncedPos?: { x: number; y: number };
  hitNet: boolean;
  outOfBounds: boolean;
}

export function createInitialBall(): BallEntity {
  return {
    x: 2.0,
    y: COURT_HALF_LENGTH + 0.3,
    z: 1.0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0,
    lastHitBy: null,
    bounces: 0,
    inPlay: false,
    trail: [],
  };
}

export function updateBallPhysics(
  ball: BallEntity,
  dt: number,
  surface: CourtSurface = 'hard'
): TrajectoryResult {
  if (!ball.inPlay) {
    return { hitGround: false, hitNet: false, outOfBounds: false };
  }

  // Previous position for net crossing detection
  const prevY = ball.y;

  // Apply gravity & Magnus effect from spin
  // topspin: pushes ball downwards faster; slice: floats ball in air slightly longer
  const magnusZ = -ball.spin * 2.2;
  ball.vz -= (GRAVITY + magnusZ) * dt;

  // Air drag
  const dragFactor = 1.0 - 0.08 * dt;
  ball.vx *= dragFactor;
  ball.vy *= dragFactor;

  // Move
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  // Update visual trail
  ball.trail.unshift({ x: ball.x, y: ball.y, z: ball.z, alpha: 1.0 });
  if (ball.trail.length > 8) {
    ball.trail.pop();
  }
  for (let i = 0; i < ball.trail.length; i++) {
    ball.trail[i].alpha *= 0.82;
  }

  let hitNet = false;
  let hitGround = false;
  let bouncedPos: { x: number; y: number } | undefined;
  let outOfBounds = false;

  // 1. Net collision check (net is at y = 0)
  if ((prevY > 0 && ball.y <= 0) || (prevY < 0 && ball.y >= 0)) {
    // Interpolate z at y = 0
    const ratio = Math.abs(prevY) / (Math.abs(prevY) + Math.abs(ball.y));
    const zAtNet = ball.z - ball.vz * dt * (1 - ratio);
    const xAtNet = ball.x - ball.vx * dt * (1 - ratio);

    // Net height curves from 0.914m at center to 1.07m at singles sidelines
    const distFromCenter = Math.min(1.0, Math.abs(xAtNet) / COURT_HALF_WIDTH);
    const currentNetHeight = NET_HEIGHT_CENTER + (NET_HEIGHT_POST - NET_HEIGHT_CENTER) * distFromCenter;

    if (zAtNet <= currentNetHeight) {
      // Hit the net!
      hitNet = true;
      ball.y = prevY > 0 ? 0.05 : -0.05;
      ball.vy = -ball.vy * 0.25; // dead bounce back
      ball.vx *= 0.3;
      ball.vz = Math.min(ball.vz * 0.3, 1.0);
    }
  }

  // 2. Ground bounce check
  if (ball.z <= 0) {
    ball.z = 0;
    const downwardSpeed = -ball.vz; // Positive when ball was traveling downwards

    if (downwardSpeed > 0.4) {
      hitGround = true;
      ball.bounces += 1;
      bouncedPos = { x: ball.x, y: ball.y };

      // Surface restitution
      let restitution = 0.74; // Hard court default
      let friction = 0.88;
      if (surface === 'clay') {
        restitution = 0.78; // higher bounce
        friction = 0.82; // slower forward pace
      } else if (surface === 'grass') {
        restitution = 0.68; // lower, faster skid
        friction = 0.92;
      }

      // Topspin / slice effect on bounce
      if (ball.spin > 0) {
        // Topspin kicks forward faster
        ball.vy *= (friction + 0.05);
        ball.vz = -ball.vz * (restitution + 0.04);
      } else if (ball.spin < 0) {
        // Slice skids and stays low
        ball.vy *= (friction - 0.08);
        ball.vz = -ball.vz * (restitution - 0.12);
      } else {
        ball.vz = -ball.vz * restitution;
        ball.vy *= friction;
      }

      ball.vx *= friction;

      // Settle small vertical velocities to zero to stop micro-bouncing
      if (Math.abs(ball.vz) < 0.4) {
        ball.vz = 0;
      }

      // Reset spin mostly on bounce
      ball.spin *= 0.3;

      // Check if bounce was out of court
      if (Math.abs(ball.x) > COURT_HALF_WIDTH || Math.abs(ball.y) > COURT_HALF_LENGTH) {
        outOfBounds = true;
      }
    } else {
      // Ball is resting or rolling on ground - no bounce sound or bounce event!
      ball.vz = 0;
      ball.vx *= 0.85;
      ball.vy *= 0.85;
      if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
      if (Math.abs(ball.vy) < 0.05) ball.vy = 0;
      hitGround = false;
    }
  }

  return { hitGround, bouncedPos, hitNet, outOfBounds };
}

// Calculate shot impulse based on shot type and player aim
export function computeShotVelocity(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  shotType: ShotType,
  powerMultiplier: number = 1.0
): { vx: number; vy: number; vz: number; spin: number } {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const distY = Math.abs(dy);

  // Time of flight estimated based on distance and shot type
  let timeOfFlight = 0.65;
  let spin = 0;
  let baseArcHeight = 1.8;

  switch (shotType) {
    case 'topspin':
      timeOfFlight = Math.max(0.48, distY * 0.038 / powerMultiplier);
      spin = 1.5;
      baseArcHeight = 1.5;
      break;
    case 'slice':
      timeOfFlight = Math.max(0.72, distY * 0.055 / powerMultiplier);
      spin = -1.5;
      baseArcHeight = 1.1;
      break;
    case 'lob':
      timeOfFlight = Math.max(1.1, distY * 0.075);
      spin = 0.5;
      baseArcHeight = 4.2;
      break;
    case 'smash':
      timeOfFlight = Math.max(0.35, distY * 0.026 / powerMultiplier);
      spin = 0.8;
      baseArcHeight = 0.8;
      break;
    case 'flat':
    default:
      timeOfFlight = Math.max(0.55, distY * 0.042 / powerMultiplier);
      spin = 0.1;
      baseArcHeight = 1.4;
      break;
  }

  const vx = dx / timeOfFlight;
  const vy = dy / timeOfFlight;

  // Ball trajectory: z(t) = vz0 * t - 0.5 * g * t^2
  // We want the apex around net (y=0) or desired height
  const vz = (baseArcHeight / (timeOfFlight * 0.5)) + (0.5 * GRAVITY * timeOfFlight * 0.5);

  return { vx, vy, vz, spin };
}

// Check whether a serve landed inside legal service box
export function isLegalServe(
  bounceX: number,
  bounceY: number,
  server: 'player' | 'ai',
  side: 'deuce' | 'ad'
): boolean {
  // Service box margins
  const inWidth = Math.abs(bounceX) <= COURT_HALF_WIDTH;
  
  if (server === 'player') {
    // Player serves to AI side: y is between -SERVICE_LINE_DIST and 0
    const inServiceDepth = bounceY >= -SERVICE_LINE_DIST && bounceY < 0;
    if (!inServiceDepth || !inWidth) return false;

    // Deuce side (Player serves from right to AI's left box: x < 0)
    if (side === 'deuce') {
      return bounceX <= 0;
    } else {
      // Ad side (Player serves from left to AI's right box: x > 0)
      return bounceX >= 0;
    }
  } else {
    // AI serves to Player side: y is between 0 and SERVICE_LINE_DIST
    const inServiceDepth = bounceY > 0 && bounceY <= SERVICE_LINE_DIST;
    if (!inServiceDepth || !inWidth) return false;

    // Deuce side (AI serves from right to Player's left box: x < 0)
    if (side === 'deuce') {
      return bounceX <= 0;
    } else {
      return bounceX >= 0;
    }
  }
}
