import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BallEntity,
  ControlMode,
  CourtSurface,
  GameDifficulty,
  GameState,
  MatchStats,
  PlayerEntity,
  ScoreState,
  ShotType,
  SwingDirection,
  TechniqueFeedback,
} from '../types';
import { soundManager } from '../utils/audio';
import { createInitialAIState, updateAI, AIState } from './ai';
import {
  computeShotVelocity,
  COURT_DOUBLES_HALF_WIDTH,
  COURT_HALF_LENGTH,
  COURT_HALF_WIDTH,
  createInitialBall,
  isLegalServe,
  NET_HEIGHT_CENTER,
  NET_HEIGHT_POST,
  SERVICE_LINE_DIST,
  updateBallPhysics,
} from './physics';
import { SteeringHelm } from '../components/SteeringHelm';
import { ActionSwingButton } from '../components/ActionSwingButton';
import { TechniqueDisplayBanner } from '../components/TechniqueDisplayBanner';

interface TennisCanvasProps {
  surface: CourtSurface;
  difficulty: GameDifficulty;
  controlMode: ControlMode;
  isPaused: boolean;
  score: ScoreState;
  onScoreUpdate: (newScore: ScoreState, eventText?: string, isWinner?: boolean) => void;
  stats: MatchStats;
  onStatsUpdate: (updater: (prev: MatchStats) => MatchStats) => void;
  onGameOver: (winner: 'player' | 'ai') => void;
}

interface SparkParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number;
  maxLife: number;
}

interface BounceRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color?: string;
}

interface CanvasFloatingText {
  id: number;
  text: string;
  subText?: string;
  color: string;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
}

export const TennisCanvas: React.FC<TennisCanvasProps> = ({
  surface,
  difficulty,
  controlMode,
  isPaused,
  score,
  onScoreUpdate,
  stats,
  onStatsUpdate,
  onGameOver,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Floating notification text (e.g. "ACE!", "OUT!", "FAULT!")
  const [hudMessage, setHudMessage] = useState<{ text: string; color: string } | null>(null);

  // Active technique feedback display (for banner and special effects)
  const [activeTechnique, setActiveTechnique] = useState<TechniqueFeedback | null>(null);

  // Entities Ref for persistent animation loop access
  const ballRef = useRef<BallEntity>(createInitialBall());
  const playerRef = useRef<PlayerEntity>({
    x: 0,
    y: COURT_HALF_LENGTH + 0.4,
    z: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    isSwinging: false,
    swingProgress: 0,
    swingType: 'flat',
    stamina: 100,
    color: '#3b82f6',
  });
  const aiRef = useRef<PlayerEntity>({
    x: 0,
    y: -COURT_HALF_LENGTH - 0.4,
    z: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    isSwinging: false,
    swingProgress: 0,
    swingType: 'flat',
    stamina: 100,
    color: '#ef4444',
  });
  const aiStateRef = useRef<AIState>(createInitialAIState());
  const gameStateRef = useRef<GameState>('serving');
  const particlesRef = useRef<SparkParticle[]>([]);
  const bounceRingsRef = useRef<BounceRing[]>([]);
  const canvasFloatingTextsRef = useRef<CanvasFloatingText[]>([]);

  // Input states
  const helmInput = useRef<number>(0); // -1.0 (left) to +1.0 (right) from steering helm
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const touchJoystick = useRef<{ active: boolean; startX: number; startY: number; curX: number; curY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
  });
  const touchAim = useRef<{ targetX: number; targetY: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Sync state between referee & render loop
  const scoreRef = useRef(score);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset court entities whenever score is reset to 0-0 from outside (e.g. restart / play again)
  useEffect(() => {
    scoreRef.current = score;
    if (
      score.playerPoints === 0 &&
      score.aiPoints === 0 &&
      score.playerGames === 0 &&
      score.aiGames === 0 &&
      score.playerSets === 0 &&
      score.aiSets === 0
    ) {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      resetForNextServe();
      particlesRef.current = [];
      bounceRingsRef.current = [];
      canvasFloatingTextsRef.current = [];
      setActiveTechnique(null);
      setHudMessage(null);
    }
  }, [score]);

  const showHud = useCallback((text: string, color: string = '#facc15') => {
    setHudMessage({ text, color });
    setTimeout(() => {
      setHudMessage(null);
    }, 1200);
  }, []);

  // Point scoring handler
  const awardPointTo = useCallback(
    (winner: 'player' | 'ai', reason: string, isAce: boolean = false) => {
      if (gameStateRef.current === 'point_ended' || gameStateRef.current === 'game_over') return;
      gameStateRef.current = 'point_ended';

      // Immediately silence and halt the ball so it cannot micro-bounce or trigger repeated sounds
      ballRef.current.inPlay = false;
      ballRef.current.vx = 0;
      ballRef.current.vy = 0;
      ballRef.current.vz = 0;

      soundManager.playScore(winner === 'player');
      if (isAce) {
        soundManager.playCheer();
      }

      // Update stats
      onStatsUpdate((prev) => {
        const next = { ...prev };
        next.totalPointsWon[winner]++;
        if (isAce) next.aces[winner]++;
        if (next.currentRally > next.longestRally) {
          next.longestRally = next.currentRally;
        }
        next.currentRally = 0;
        return next;
      });

      // Calculate tennis score progression
      const current = { ...scoreRef.current };
      let p = current.playerPoints;
      let a = current.aiPoints;

      if (winner === 'player') {
        if (p === 3 && a === 3) {
          // Deuce -> Advantage Player
          p = 4;
        } else if (p === 3 && a < 3) {
          // 40-X -> Game Player
          p = 0;
          a = 0;
          current.playerGames += 1;
          showHud('🎉 本局获胜！', '#22c55e');
          soundManager.playCheer();
        } else if (p === 4) {
          // Ad in -> Game
          p = 0;
          a = 0;
          current.playerGames += 1;
          showHud('🎉 突破拿下局分！', '#22c55e');
          soundManager.playCheer();
        } else if (a === 4) {
          // Back to Deuce
          a = 3;
        } else {
          p += 1;
        }
      } else {
        // AI win point
        if (p === 3 && a === 3) {
          a = 4;
        } else if (a === 3 && p < 3) {
          p = 0;
          a = 0;
          current.aiGames += 1;
          showHud('电脑拿下一局', '#ef4444');
        } else if (a === 4) {
          p = 0;
          a = 0;
          current.aiGames += 1;
          showHud('电脑拿下一局', '#ef4444');
        } else if (p === 4) {
          p = 3;
        } else {
          a += 1;
        }
      }

      // Check if Set is won (First to 3 games in quick match format or 6 in pro)
      const gamesToWinSet = 3;
      if (current.playerGames >= gamesToWinSet && current.playerGames - current.aiGames >= 1) {
        current.playerSets += 1;
        current.playerGames = 0;
        current.aiGames = 0;
        gameStateRef.current = 'game_over';
        ballRef.current.inPlay = false;
        ballRef.current.vx = 0;
        ballRef.current.vy = 0;
        ballRef.current.vz = 0;
        showHud('🏆 赢得比赛！', '#f59e0b');
        soundManager.playCheer();
        onGameOver('player');
        return;
      } else if (current.aiGames >= gamesToWinSet && current.aiGames - current.playerGames >= 1) {
        current.aiSets += 1;
        current.playerGames = 0;
        current.aiGames = 0;
        gameStateRef.current = 'game_over';
        ballRef.current.inPlay = false;
        ballRef.current.vx = 0;
        ballRef.current.vy = 0;
        ballRef.current.vz = 0;
        showHud('电脑赢得比赛', '#ef4444');
        onGameOver('ai');
        return;
      }

      // Alternate server if game was won, otherwise alternate serve court side (Deuce / Ad)
      if (p === 0 && a === 0) {
        current.server = current.server === 'player' ? 'ai' : 'player';
        current.currentServeSide = 'deuce';
      } else {
        current.currentServeSide = current.currentServeSide === 'deuce' ? 'ad' : 'deuce';
      }

      current.playerPoints = p;
      current.aiPoints = a;
      current.isDeuce = p === 3 && a === 3;
      current.faultCount = 0;

      onScoreUpdate(current, `${winner === 'player' ? '玩家' : '电脑'}得分 (${reason})`);

      // Reset for next serve after 1.5s delay
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      resetTimeoutRef.current = setTimeout(() => {
        resetForNextServe();
        resetTimeoutRef.current = null;
      }, 1400);
    },
    [onGameOver, onScoreUpdate, onStatsUpdate, showHud]
  );

  // Reset ball and players for next serve
  const resetForNextServe = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    const cur = scoreRef.current;
    const isPlayerServer = cur.server === 'player';
    const side = cur.currentServeSide;

    const serveX = side === 'deuce' ? 2.0 : -2.0;

    if (isPlayerServer) {
      playerRef.current.x = serveX;
      playerRef.current.y = COURT_HALF_LENGTH + 0.4;
      aiRef.current.x = side === 'deuce' ? -2.2 : 2.2;
      aiRef.current.y = -COURT_HALF_LENGTH - 0.4;

      ballRef.current.x = serveX + 0.3;
      ballRef.current.y = COURT_HALF_LENGTH + 0.2;
      ballRef.current.z = 1.0;
    } else {
      aiRef.current.x = serveX;
      aiRef.current.y = -COURT_HALF_LENGTH - 0.4;
      playerRef.current.x = side === 'deuce' ? -2.2 : 2.2;
      playerRef.current.y = COURT_HALF_LENGTH + 0.4;

      ballRef.current.x = serveX - 0.3;
      ballRef.current.y = -COURT_HALF_LENGTH - 0.2;
      ballRef.current.z = 1.0;
    }

    ballRef.current.vx = 0;
    ballRef.current.vy = 0;
    ballRef.current.vz = 0;
    ballRef.current.inPlay = false;
    ballRef.current.bounces = 0;
    ballRef.current.lastHitBy = null;
    ballRef.current.trail = [];

    aiStateRef.current = createInitialAIState();
    gameStateRef.current = 'serving';
  }, []);

  const createImpactSparks = (x: number, y: number, z: number, color: string, count: number = 14) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 5.5,
        vy: (Math.random() - 0.5) * 5.5,
        vz: Math.random() * 4 + 1.2,
        color,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.18,
      });
    }
  };

  // Comprehensive player swing handler supporting tap and directional actions (up/down/left/right)
  const handlePlayerSwingWithDirection = useCallback(
    (direction: SwingDirection = 'tap') => {
      const isPlayerServing = gameStateRef.current === 'serving' && scoreRef.current.server === 'player';
      const side = scoreRef.current.currentServeSide;

      if (isPlayerServing) {
        let shotType: ShotType = 'flat';
        let targetAimX = side === 'deuce' ? -2.2 : 2.2;
        let targetAimY = -4.0;
        let speedKmh = 156;
        let name = '🎾 标准平击发球';
        let enName = 'Flat Serve';
        let color = '#22c55e';
        let desc = '高速平击·稳定压线';
        let icon = '🎾';

        if (direction === 'up') {
          shotType = 'topspin';
          targetAimX = side === 'deuce' ? -2.0 : 2.0;
          speedKmh = 148;
          name = '⚡ 强力上旋发球';
          enName = 'Kick Serve';
          color = '#38bdf8';
          desc = '强劲上旋·高跳逼退';
          icon = '⚡';
        } else if (direction === 'down') {
          shotType = 'slice';
          targetAimX = side === 'deuce' ? -3.4 : 3.4;
          speedKmh = 138;
          name = '🎯 外角切削发球';
          enName = 'Slice Serve';
          color = '#f59e0b';
          desc = '侧旋外角·极限扯开';
          icon = '🎯';
        } else if (direction === 'left') {
          shotType = 'flat';
          targetAimX = -3.2;
          speedKmh = 152;
          name = '🚀 内角深区发球';
          enName = 'Inside Serve';
          color = '#a855f7';
          desc = '深区直击·撕扯死角';
          icon = '🚀';
        } else if (direction === 'right') {
          shotType = 'flat';
          targetAimX = 3.2;
          speedKmh = 155;
          name = '⚡ 外角穿透发球';
          enName = 'Wide Serve';
          color = '#06b6d4';
          desc = '极限外角·追身压制';
          icon = '⚡';
        }

        const shot = computeShotVelocity(
          playerRef.current.x,
          playerRef.current.y,
          targetAimX,
          targetAimY,
          shotType,
          1.08
        );

        const b = ballRef.current;
        b.vx = shot.vx;
        b.vy = shot.vy;
        b.vz = shot.vz;
        b.spin = shot.spin;
        b.inPlay = true;
        b.bounces = 0;
        b.lastHitBy = 'player';

        const p = playerRef.current;
        p.isSwinging = true;
        p.swingProgress = 0;
        p.swingType = shotType;

        gameStateRef.current = 'rally';
        soundManager.playHit('smash');

        const techFeedback: TechniqueFeedback = {
          id: `serve-${direction}-${Date.now()}`,
          name,
          enName,
          icon,
          color,
          speedKmh,
          description: desc,
        };

        setActiveTechnique(techFeedback);
        createImpactSparks(b.x, b.y, b.z, color, 18);

        bounceRingsRef.current.push({
          x: p.x,
          y: p.y,
          radius: 0.2,
          maxRadius: 1.8,
          alpha: 0.9,
          color,
        });

        canvasFloatingTextsRef.current.push({
          id: Date.now(),
          text: name,
          subText: enName,
          color,
          x: p.x,
          y: p.y,
          z: 2.2,
          life: 0,
          maxLife: 1.3,
        });
        return;
      }

      if (gameStateRef.current !== 'rally' || !ballRef.current.inPlay) return;

      const p = playerRef.current;
      const b = ballRef.current;

      // Strike zone check
      const distX = Math.abs(b.x - p.x);
      const distY = Math.abs(b.y - p.y);
      const distZ = b.z;

      const reachable = distX <= 2.2 && distY <= 2.2 && distZ >= 0.1 && distZ <= 3.2;

      if (!reachable) {
        // Air swing
        p.isSwinging = true;
        p.swingProgress = 0;
        p.swingType = 'flat';
        return;
      }

      // Determine shot technique from direction
      let shotType: ShotType = 'flat';
      let targetX = p.x < 0 ? 2.4 : -2.4;
      let targetY = -COURT_HALF_LENGTH + 1.2;
      let power = 1.05;
      let speedKmh = Math.floor(138 + Math.random() * 12);
      let name = '💥 标准平击球';
      let enName = 'Flat Drive';
      let color = '#22c55e';
      let desc = '稳健抽击·穿透相持';
      let icon = '💥';

      if (direction === 'up') {
        // If ball is high, execute Overhead Smash!
        if (b.z >= 1.5 || (b.y < 9 && b.z >= 1.2)) {
          shotType = 'smash';
          power = 1.32;
          targetX = p.x < 0 ? 2.8 : -2.8;
          targetY = -COURT_HALF_LENGTH + 2.0;
          speedKmh = Math.floor(168 + Math.random() * 18);
          name = '🔥 终结扣杀';
          enName = 'Overhead Smash';
          color = '#ef4444';
          desc = '凌空暴扣·势不可挡';
          icon = '🔥';
        } else {
          shotType = 'topspin';
          power = 1.15;
          targetX = p.x < 0 ? 2.6 : -2.6;
          targetY = -COURT_HALF_LENGTH + 0.6; // deep baseline
          speedKmh = Math.floor(146 + Math.random() * 12);
          name = '⚡ 强力上旋';
          enName = 'Heavy Topspin';
          color = '#38bdf8';
          desc = '下压重旋·极速前冲';
          icon = '⚡';
        }
      } else if (direction === 'down') {
        shotType = 'slice';
        power = 0.92;
        targetX = p.x < 0 ? 1.6 : -1.6;
        targetY = -COURT_HALF_LENGTH + 4.8; // shallow net drop
        speedKmh = Math.floor(112 + Math.random() * 10);
        name = '🎯 战术切削';
        enName = 'Tactical Slice';
        color = '#f59e0b';
        desc = '反拍切削·贴网低跳';
        icon = '🎯';
      } else if (direction === 'left') {
        shotType = 'topspin';
        power = 1.12;
        targetX = -COURT_HALF_WIDTH + 0.5; // -3.6m sharp left angle
        targetY = -COURT_HALF_LENGTH + 2.5;
        speedKmh = Math.floor(136 + Math.random() * 12);
        name = '🚀 左角大斜线';
        enName = 'Cross-Court Left';
        color = '#a855f7';
        desc = '大角度调动·撕裂防线';
        icon = '🚀';
      } else if (direction === 'right') {
        shotType = 'flat';
        power = 1.22;
        targetX = COURT_HALF_WIDTH - 0.5; // +3.6m down the right sideline
        targetY = -COURT_HALF_LENGTH + 0.5;
        speedKmh = Math.floor(154 + Math.random() * 14);
        name = '⚡ 右线穿透球';
        enName = 'Down The Line';
        color = '#06b6d4';
        desc = '边线穿越·一击制胜';
        icon = '⚡';
      }

      p.isSwinging = true;
      p.swingProgress = 0;
      p.swingType = shotType;

      const shot = computeShotVelocity(p.x, p.y, targetX, targetY, shotType, power);
      b.vx = shot.vx;
      b.vy = shot.vy;
      b.vz = shot.vz;
      b.spin = shot.spin;
      b.lastHitBy = 'player';
      b.bounces = 0;

      onStatsUpdate((prev) => ({ ...prev, currentRally: prev.currentRally + 1 }));

      soundManager.playHit(shotType === 'smash' ? 'smash' : shotType);
      createImpactSparks(b.x, b.y, b.z, color, 18);

      const techFeedback: TechniqueFeedback = {
        id: `tech-${Date.now()}`,
        name,
        enName,
        icon,
        color,
        speedKmh,
        description: desc,
      };

      setActiveTechnique(techFeedback);

      bounceRingsRef.current.push({
        x: p.x,
        y: p.y,
        radius: 0.2,
        maxRadius: 1.8,
        alpha: 0.9,
        color,
      });

      canvasFloatingTextsRef.current.push({
        id: Date.now(),
        text: name,
        subText: enName,
        color,
        x: p.x,
        y: p.y,
        z: 2.2,
        life: 0,
        maxLife: 1.3,
      });
    },
    [onStatsUpdate]
  );

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;

      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        handlePlayerSwingWithDirection('tap');
      } else if (e.code === 'KeyK' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (e.code === 'KeyK') {
          e.preventDefault();
          handlePlayerSwingWithDirection('up');
        }
      } else if (e.code === 'KeyL' || e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (e.code === 'KeyL') {
          e.preventDefault();
          handlePlayerSwingWithDirection('down');
        }
      } else if (e.code === 'KeyU') {
        e.preventDefault();
        handlePlayerSwingWithDirection('left');
      } else if (e.code === 'KeyO') {
        e.preventDefault();
        handlePlayerSwingWithDirection('right');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handlePlayerSwingWithDirection]);

  // Main 60FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      if (!isPaused) {
        // --- 1. UPDATE PLAYER MOVEMENT ---
        const p = playerRef.current;
        const pSpeedX = 11.6; // Significantly faster lateral speed for quick court coverage
        const pSpeedY = 7.5;
        let moveX = 0;
        let moveY = 0;

        // Keyboard inputs
        if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) moveX -= 1;
        if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) moveX += 1;
        if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) moveY -= 1;
        if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) moveY += 1;

        // Steering helm input (semi-transparent left rudder)
        if (Math.abs(helmInput.current) > 0.02) {
          moveX += helmInput.current;
        }

        // Virtual joystick input (fallback if touch drag occurs)
        if (touchJoystick.current.active) {
          const dx = touchJoystick.current.curX - touchJoystick.current.startX;
          const dy = touchJoystick.current.curY - touchJoystick.current.startY;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 8) {
            moveX = dx / Math.max(40, len);
            moveY = dy / Math.max(40, len);
          }
        }

        const clampedMoveX = Math.max(-1, Math.min(1, moveX));
        if (clampedMoveX !== 0 || moveY !== 0) {
          p.x += clampedMoveX * pSpeedX * dt;
          p.y += moveY * pSpeedY * dt;
          p.facing = clampedMoveX >= 0 ? 1 : -1;
        }

        // Clamp player within realistic baseline region
        p.x = Math.max(-COURT_DOUBLES_HALF_WIDTH - 1.2, Math.min(COURT_DOUBLES_HALF_WIDTH + 1.2, p.x));
        p.y = Math.max(1.5, Math.min(COURT_HALF_LENGTH + 2.5, p.y));

        // Player swing animation progress
        if (p.isSwinging) {
          p.swingProgress += dt * 6.5;
          if (p.swingProgress >= 1) {
            p.isSwinging = false;
            p.swingProgress = 0;
          }
        }

        // --- 2. UPDATE AI OPPONENT ---
        const ai = aiRef.current;
        const ball = ballRef.current;
        const isAIServing = gameStateRef.current === 'serving' && scoreRef.current.server === 'ai';

        const aiResult = updateAI(
          ai,
          aiStateRef.current,
          ball,
          p,
          difficulty,
          dt,
          isAIServing,
          scoreRef.current.currentServeSide
        );

        if (aiResult.shouldServe && aiResult.shotParams) {
          ball.vx = aiResult.shotParams.vx;
          ball.vy = aiResult.shotParams.vy;
          ball.vz = aiResult.shotParams.vz;
          ball.spin = aiResult.shotParams.spin;
          ball.inPlay = true;
          ball.bounces = 0;
          ball.lastHitBy = 'ai';

          ai.isSwinging = true;
          ai.swingProgress = 0;
          ai.swingType = aiResult.shotParams.type;

          gameStateRef.current = 'rally';
          soundManager.playHit('smash');
          createImpactSparks(ball.x, ball.y, ball.z, '#ef4444');
        } else if (aiResult.shouldSwing && aiResult.shotParams) {
          ai.isSwinging = true;
          ai.swingProgress = 0;
          ai.swingType = aiResult.shotParams.type;

          ball.vx = aiResult.shotParams.vx;
          ball.vy = aiResult.shotParams.vy;
          ball.vz = aiResult.shotParams.vz;
          ball.spin = aiResult.shotParams.spin;
          ball.lastHitBy = 'ai';
          ball.bounces = 0;

          onStatsUpdate((prev) => ({ ...prev, currentRally: prev.currentRally + 1 }));
          soundManager.playHit(aiResult.shotParams.type);
          createImpactSparks(ball.x, ball.y, ball.z, '#f87171');
        }

        if (ai.isSwinging) {
          ai.swingProgress += dt * 6.5;
          if (ai.swingProgress >= 1) {
            ai.isSwinging = false;
            ai.swingProgress = 0;
          }
        }

        // --- 3. BALL PHYSICS & TENNIS REFEREE CHECKS ---
        if (gameStateRef.current === 'serving') {
          if (scoreRef.current.server === 'player') {
            ball.x = p.x + 0.35;
            ball.y = p.y - 0.25;
            ball.z = 1.05 + Math.sin(time * 0.005) * 0.08;
            ball.vx = 0;
            ball.vy = 0;
            ball.vz = 0;
            ball.inPlay = false;
          } else {
            ball.x = ai.x - 0.35;
            ball.y = ai.y + 0.25;
            ball.z = 1.05 + Math.sin(time * 0.005) * 0.08;
            ball.vx = 0;
            ball.vy = 0;
            ball.vz = 0;
            ball.inPlay = false;
          }
        } else if (ball.inPlay) {
          const phys = updateBallPhysics(ball, dt, surface);

          if (phys.hitGround && ball.inPlay && gameStateRef.current === 'rally') {
            soundManager.playBounce();
            bounceRingsRef.current.push({
              x: ball.x,
              y: ball.y,
              radius: 0.1,
              maxRadius: 0.8,
              alpha: 0.7,
            });

            // Serve bounce check (first bounce of the serve)
            const wasServe = ball.lastHitBy && ball.bounces === 1 && Math.abs(ball.vy) > 0;
            const isFirstBounceOfServe =
              scoreRef.current.faultCount <= 1 && gameStateRef.current === 'rally';

            // First bounce out of bounds?
            if (phys.outOfBounds && ball.bounces === 1) {
              soundManager.playWhistle();
              showHud('出界 (OUT)', '#ef4444');
              // The opponent of whoever hit it wins point
              const pointWinner = ball.lastHitBy === 'player' ? 'ai' : 'player';
              awardPointTo(pointWinner, '球出界');
            } else if (ball.bounces >= 2) {
              // Two bounces rule!
              // Whoever let it bounce twice on their side loses point
              // If ball.y > 0 (player side), AI scores; if ball.y < 0 (AI side), Player scores!
              const winner = ball.y > 0 ? 'ai' : 'player';
              const isAceCandidate = ball.bounces === 2 && !ai.isSwinging && !p.isSwinging;
              showHud(winner === 'player' ? '得分！' : '电脑得分', winner === 'player' ? '#22c55e' : '#ef4444');
              awardPointTo(winner, '两跳落地', isAceCandidate);
            }
          }

          if (phys.hitNet) {
            soundManager.playWhistle();
            showHud('触网 (NET)', '#ef4444');
            const winner = ball.lastHitBy === 'player' ? 'ai' : 'player';
            awardPointTo(winner, '回球触网');
          }

          // Ball flew way too far behind baseline without bouncing
          if (Math.abs(ball.y) > COURT_HALF_LENGTH + 4.5 && ball.bounces === 0) {
            soundManager.playWhistle();
            showHud('界外未及 (OUT)', '#ef4444');
            const winner = ball.lastHitBy === 'player' ? 'ai' : 'player';
            awardPointTo(winner, '直接出界');
          }
        }

        // Particles & Rings update
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const pt = particlesRef.current[i];
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.z += pt.vz * dt;
          pt.vz -= 9.8 * dt;
          pt.life += dt;
          if (pt.life >= pt.maxLife) {
            particlesRef.current.splice(i, 1);
          }
        }

        for (let i = bounceRingsRef.current.length - 1; i >= 0; i--) {
          const r = bounceRingsRef.current[i];
          r.radius += dt * 1.8;
          r.alpha -= dt * 1.6;
          if (r.alpha <= 0) {
            bounceRingsRef.current.splice(i, 1);
          }
        }

        // Update floating technique texts in canvas
        for (let i = canvasFloatingTextsRef.current.length - 1; i >= 0; i--) {
          const ft = canvasFloatingTextsRef.current[i];
          ft.z += 0.85 * dt;
          ft.life += dt;
          if (ft.life >= ft.maxLife) {
            canvasFloatingTextsRef.current.splice(i, 1);
          }
        }
      }

      // --- 4. RENDER FRAME ---
      renderScene(ctx, canvas);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [awardPointTo, difficulty, isPaused, showHud, surface]);

  // Handle responsive canvas sizing & high DPI
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = container.getBoundingClientRect();

      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Perspective Projection: Court (x, y, z) -> Screen (sx, sy)
  const projectPoint = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number
  ): { x: number; y: number; scale: number } => {
    // Camera is elevated and court is shifted upwards to give ample operational space below
    const horizonY = height * 0.12;
    const groundSpanY = height * 0.58;

    // Normalizing y from -14 to +14 into 0 to 1 depth
    const depthT = (y + COURT_HALF_LENGTH + 2.5) / (2 * COURT_HALF_LENGTH + 5.0);
    const clampedT = Math.max(0.01, Math.min(1.0, depthT));

    // Perspective scale increases as y gets closer to player (bottom)
    const scale = 0.52 + clampedT * 0.76;

    const screenX = width * 0.5 + (x * width * 0.058) * scale;
    const screenY = horizonY + clampedT * groundSpanY - z * height * 0.055 * scale;

    return { x: screenX, y: screenY, scale };
  };

  // Render Full 2.5D Tennis Court, Shadows, Characters & FX
  const renderScene = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // 1. Stadium background / Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.15);
    if (surface === 'grass') {
      skyGrad.addColorStop(0, '#0f2415');
      skyGrad.addColorStop(1, '#1b3f26');
    } else if (surface === 'clay') {
      skyGrad.addColorStop(0, '#2d1b15');
      skyGrad.addColorStop(1, '#4e281e');
    } else {
      skyGrad.addColorStop(0, '#0c1a2e');
      skyGrad.addColorStop(1, '#132c4a');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Stadium Grandstand / Crowd silhouettes
    renderStadium(ctx, w, h);

    // 2. Court Floor (Surround + Main Playing Area)
    renderCourt(ctx, w, h);

    // 3. Bounce Rings on Ground
    for (const r of bounceRingsRef.current) {
      const p = projectPoint(r.x, r.y, 0, w, h);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r.radius * w * 0.02 * p.scale, r.radius * h * 0.01 * p.scale, 0, 0, Math.PI * 2);
      ctx.strokeStyle = r.color ? `${r.color}` : `rgba(255, 255, 255, ${r.alpha})`;
      ctx.lineWidth = (r.color ? 3 : 2) * p.scale;
      ctx.stroke();
    }

    // 4. Shadows (Projected at z=0)
    // AI Shadow
    const aiShadow = projectPoint(aiRef.current.x, aiRef.current.y, 0, w, h);
    drawEntityShadow(ctx, aiShadow.x, aiShadow.y, 22 * aiShadow.scale);

    // Player Shadow
    const pShadow = projectPoint(playerRef.current.x, playerRef.current.y, 0, w, h);
    drawEntityShadow(ctx, pShadow.x, pShadow.y, 26 * pShadow.scale);

    // Ball Shadow
    const ball = ballRef.current;
    if (ball.inPlay || gameStateRef.current === 'serving') {
      const bShadow = projectPoint(ball.x, ball.y, 0, w, h);
      const shadowSize = Math.max(4, (14 - ball.z * 1.5) * bShadow.scale);
      const shadowAlpha = Math.max(0.15, 0.65 - ball.z * 0.1);
      ctx.beginPath();
      ctx.ellipse(bShadow.x, bShadow.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.fill();
    }

    // 5. Net (y = 0)
    renderNet(ctx, w, h);

    // 6. Draw AI Character (stands in far court, behind net)
    drawAthlete(ctx, aiRef.current, w, h, 'AI (电脑)', '#ef4444', '#fee2e2');

    // 7. Ball & Trail (can be in front of or behind net depending on y)
    drawBall(ctx, w, h);

    // 8. Draw Player Character (stands in near court)
    drawAthlete(ctx, playerRef.current, w, h, 'YOU (你)', '#3b82f6', '#dbeafe');

    // 9. Particle Sparks
    for (const pt of particlesRef.current) {
      const screenPt = projectPoint(pt.x, pt.y, pt.z, w, h);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(screenPt.x, screenPt.y, 3 * screenPt.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // 10. Floating Technique Action Names in 2.5D above athlete
    for (const ft of canvasFloatingTextsRef.current) {
      const screenPt = projectPoint(ft.x, ft.y, ft.z, w, h);
      const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      const fontSize = Math.max(12, Math.floor(18 * screenPt.scale));
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textWidth = ctx.measureText(ft.text).width;
      const paddingX = 12 * screenPt.scale;
      const paddingY = 6 * screenPt.scale;
      const badgeH = fontSize + paddingY * 2;
      const badgeW = textWidth + paddingX * 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(
          screenPt.x - badgeW / 2,
          screenPt.y - badgeH / 2,
          badgeW,
          badgeH,
          badgeH / 2
        );
      } else {
        ctx.rect(screenPt.x - badgeW / 2, screenPt.y - badgeH / 2, badgeW, badgeH);
      }
      ctx.fill();

      ctx.strokeStyle = ft.color;
      ctx.lineWidth = Math.max(1.5, 2 * screenPt.scale);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(ft.text, screenPt.x, screenPt.y);
      ctx.restore();
    }

    // 11. Serve Indicator / Guide Line
    if (gameStateRef.current === 'serving' && scoreRef.current.server === 'player') {
      renderServeGuide(ctx, w, h);
    }
  };

  const drawEntityShadow = (ctx: CanvasRenderingContext2D, sx: number, sy: number, radius: number) => {
    ctx.beginPath();
    ctx.ellipse(sx, sy, radius, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fill();
  };

  const renderStadium = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const horizonY = h * 0.12;
    // Stadium wall
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, Math.max(0, horizonY - h * 0.075), w, h * 0.075);

    // Grandstand seats pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let row = 0; row < 3; row++) {
      ctx.fillRect(0, Math.max(0, horizonY - h * 0.075 + row * (h * 0.018)), w, h * 0.007);
    }

    // Center Tournament Banner
    const bannerW = Math.min(w * 0.65, 340);
    const bannerX = (w - bannerW) / 2;
    const bannerH = Math.min(24, Math.max(16, h * 0.035));
    const bannerY = Math.max(4, horizonY - bannerH - 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold ${Math.max(10, Math.min(13, h * 0.016))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 GRAND SLAM TENNIS CHAMPIONSHIP', w / 2, bannerY + bannerH / 2);
  };

  const renderCourt = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const horizonY = h * 0.12;
    // Colors by surface
    let surroundColor = '#1e3a8a';
    let courtColor = '#2563eb';
    let lineColor = '#ffffff';

    if (surface === 'clay') {
      surroundColor = '#264630';
      courtColor = '#c2410c';
      lineColor = '#fef3c7';
    } else if (surface === 'grass') {
      surroundColor = '#143818';
      courtColor = '#22632b';
      lineColor = '#f8fafc';
    }

    // Fill entire lower ground from horizon down to bottom of screen with surround ground
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    if (surface === 'clay') {
      groundGrad.addColorStop(0, '#264630');
      groundGrad.addColorStop(1, '#172b1e');
    } else if (surface === 'grass') {
      groundGrad.addColorStop(0, '#143818');
      groundGrad.addColorStop(1, '#0c220e');
    } else {
      groundGrad.addColorStop(0, '#1e3a8a');
      groundGrad.addColorStop(1, '#0f1d45');
    }
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Outer Court Perimeter
    const p1 = projectPoint(-COURT_DOUBLES_HALF_WIDTH - 2.0, -COURT_HALF_LENGTH - 1.5, 0, w, h);
    const p2 = projectPoint(COURT_DOUBLES_HALF_WIDTH + 2.0, -COURT_HALF_LENGTH - 1.5, 0, w, h);
    const p3 = projectPoint(COURT_DOUBLES_HALF_WIDTH + 2.0, COURT_HALF_LENGTH + 2.8, 0, w, h);
    const p4 = projectPoint(-COURT_DOUBLES_HALF_WIDTH - 2.0, COURT_HALF_LENGTH + 2.8, 0, w, h);

    ctx.fillStyle = surroundColor;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    // Inner Court (Doubles boundary)
    const c1 = projectPoint(-COURT_DOUBLES_HALF_WIDTH, -COURT_HALF_LENGTH, 0, w, h);
    const c2 = projectPoint(COURT_DOUBLES_HALF_WIDTH, -COURT_HALF_LENGTH, 0, w, h);
    const c3 = projectPoint(COURT_DOUBLES_HALF_WIDTH, COURT_HALF_LENGTH, 0, w, h);
    const c4 = projectPoint(-COURT_DOUBLES_HALF_WIDTH, COURT_HALF_LENGTH, 0, w, h);

    ctx.fillStyle = courtColor;
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();

    // Line drawing helper
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = Math.max(2, w * 0.003);
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      const pt1 = projectPoint(x1, y1, 0, w, h);
      const pt2 = projectPoint(x2, y2, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    };

    // Court Lines:
    // Baselines
    drawLine(-COURT_DOUBLES_HALF_WIDTH, -COURT_HALF_LENGTH, COURT_DOUBLES_HALF_WIDTH, -COURT_HALF_LENGTH);
    drawLine(-COURT_DOUBLES_HALF_WIDTH, COURT_HALF_LENGTH, COURT_DOUBLES_HALF_WIDTH, COURT_HALF_LENGTH);

    // Doubles Sidelines
    drawLine(-COURT_DOUBLES_HALF_WIDTH, -COURT_HALF_LENGTH, -COURT_DOUBLES_HALF_WIDTH, COURT_HALF_LENGTH);
    drawLine(COURT_DOUBLES_HALF_WIDTH, -COURT_HALF_LENGTH, COURT_DOUBLES_HALF_WIDTH, COURT_HALF_LENGTH);

    // Singles Sidelines
    drawLine(-COURT_HALF_WIDTH, -COURT_HALF_LENGTH, -COURT_HALF_WIDTH, COURT_HALF_LENGTH);
    drawLine(COURT_HALF_WIDTH, -COURT_HALF_LENGTH, COURT_HALF_WIDTH, COURT_HALF_LENGTH);

    // Service Lines (y = -SERVICE_LINE_DIST and +SERVICE_LINE_DIST)
    drawLine(-COURT_HALF_WIDTH, -SERVICE_LINE_DIST, COURT_HALF_WIDTH, -SERVICE_LINE_DIST);
    drawLine(-COURT_HALF_WIDTH, SERVICE_LINE_DIST, COURT_HALF_WIDTH, SERVICE_LINE_DIST);

    // Center Service Line (connects both service lines through net at x = 0)
    drawLine(0, -SERVICE_LINE_DIST, 0, SERVICE_LINE_DIST);

    // Center Marks at baselines
    drawLine(0, -COURT_HALF_LENGTH, 0, -COURT_HALF_LENGTH + 0.5);
    drawLine(0, COURT_HALF_LENGTH, 0, COURT_HALF_LENGTH - 0.5);
  };

  const renderNet = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Net is at y = 0
    const postLeftBottom = projectPoint(-COURT_DOUBLES_HALF_WIDTH - 0.5, 0, 0, w, h);
    const postLeftTop = projectPoint(-COURT_DOUBLES_HALF_WIDTH - 0.5, 0, NET_HEIGHT_POST, w, h);

    const postRightBottom = projectPoint(COURT_DOUBLES_HALF_WIDTH + 0.5, 0, 0, w, h);
    const postRightTop = projectPoint(COURT_DOUBLES_HALF_WIDTH + 0.5, 0, NET_HEIGHT_POST, w, h);

    const netCenterBottom = projectPoint(0, 0, 0, w, h);
    const netCenterTop = projectPoint(0, 0, NET_HEIGHT_CENTER, w, h);

    // Net mesh background (translucent dark wire mesh)
    ctx.beginPath();
    ctx.moveTo(postLeftBottom.x, postLeftBottom.y);
    ctx.lineTo(postLeftTop.x, postLeftTop.y);
    ctx.quadraticCurveTo(netCenterTop.x, netCenterTop.y, postRightTop.x, postRightTop.y);
    ctx.lineTo(postRightBottom.x, postRightBottom.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.fill();

    // Top white tape
    ctx.beginPath();
    ctx.moveTo(postLeftTop.x, postLeftTop.y);
    ctx.quadraticCurveTo(netCenterTop.x, netCenterTop.y, postRightTop.x, postRightTop.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, w * 0.005);
    ctx.stroke();

    // Center strap
    ctx.beginPath();
    ctx.moveTo(netCenterTop.x, netCenterTop.y);
    ctx.lineTo(netCenterBottom.x, netCenterBottom.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Net posts
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(postLeftBottom.x, postLeftBottom.y);
    ctx.lineTo(postLeftTop.x, postLeftTop.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(postRightBottom.x, postRightBottom.y);
    ctx.lineTo(postRightTop.x, postRightTop.y);
    ctx.stroke();
  };

  const drawAthlete = (
    ctx: CanvasRenderingContext2D,
    athlete: PlayerEntity,
    w: number,
    h: number,
    label: string,
    jerseyColor: string,
    accentColor: string
  ) => {
    const pt = projectPoint(athlete.x, athlete.y, athlete.z, w, h);
    const scale = pt.scale;
    const bodyHeight = 52 * scale;
    const headRadius = 9 * scale;

    ctx.save();
    ctx.translate(pt.x, pt.y);

    // Name badge overhead
    ctx.font = `bold ${Math.max(10, 11 * scale)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -bodyHeight - headRadius * 2 - 6);

    // Swing Racket
    const swingAngle = athlete.isSwinging
      ? Math.sin(athlete.swingProgress * Math.PI) * (athlete.facing * 1.6)
      : athlete.facing * 0.35;

    ctx.save();
    ctx.translate(athlete.facing * 10 * scale, -bodyHeight * 0.5);
    ctx.rotate(swingAngle);

    // Racket Shaft & Grip
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22 * scale);
    ctx.stroke();

    // Racket Head / Strings
    ctx.strokeStyle = athlete.color;
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.ellipse(0, -32 * scale, 9 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Strings cross
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6 * scale, -32 * scale);
    ctx.lineTo(6 * scale, -32 * scale);
    ctx.moveTo(0, -40 * scale);
    ctx.lineTo(0, -24 * scale);
    ctx.stroke();
    ctx.restore();

    // Legs / Shorts
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-7 * scale, -16 * scale, 6 * scale, 16 * scale);
    ctx.fillRect(1 * scale, -16 * scale, 6 * scale, 16 * scale);

    // Shoes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8 * scale, -4 * scale, 7 * scale, 4 * scale);
    ctx.fillRect(1 * scale, -4 * scale, 7 * scale, 4 * scale);

    // Torso (Shirt)
    ctx.fillStyle = jerseyColor;
    ctx.beginPath();
    ctx.roundRect(-10 * scale, -bodyHeight * 0.72, 20 * scale, bodyHeight * 0.45, [4 * scale]);
    ctx.fill();

    // Head
    ctx.fillStyle = '#fed7aa'; // skin tone
    ctx.beginPath();
    ctx.arc(0, -bodyHeight - headRadius * 0.3, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Headband
    ctx.fillStyle = accentColor;
    ctx.fillRect(-headRadius, -bodyHeight - headRadius * 0.7, headRadius * 2, 4 * scale);

    ctx.restore();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const ball = ballRef.current;
    if (!ball.inPlay && gameStateRef.current !== 'serving') return;

    // Draw motion trail
    for (let i = 0; i < ball.trail.length; i++) {
      const tr = ball.trail[i];
      const trailPt = projectPoint(tr.x, tr.y, tr.z, w, h);
      ctx.beginPath();
      ctx.arc(trailPt.x, trailPt.y, Math.max(2, 6 * trailPt.scale), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(202, 250, 48, ${tr.alpha * 0.6})`; // Tennis optic yellow
      ctx.fill();
    }

    const bPt = projectPoint(ball.x, ball.y, ball.z, w, h);
    const radius = Math.max(3.5, 7.5 * bPt.scale);

    // Optic Yellow Tennis Ball with 3D gradient
    const ballGrad = ctx.createRadialGradient(
      bPt.x - radius * 0.3,
      bPt.y - radius * 0.3,
      radius * 0.1,
      bPt.x,
      bPt.y,
      radius
    );
    ballGrad.addColorStop(0, '#fef08a');
    ballGrad.addColorStop(0.5, '#ccff00');
    ballGrad.addColorStop(1, '#84cc16');

    ctx.beginPath();
    ctx.arc(bPt.x, bPt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Seam curve on ball
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(1, 1.2 * bPt.scale);
    ctx.beginPath();
    ctx.arc(bPt.x, bPt.y, radius * 0.65, -0.6, 1.6);
    ctx.stroke();
  };

  const renderServeGuide = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const side = scoreRef.current.currentServeSide;
    const targetX = side === 'deuce' ? -2.0 : 2.0;
    const targetY = -4.0;

    const startPt = projectPoint(playerRef.current.x, playerRef.current.y, 0, w, h);
    const endPt = projectPoint(targetX, targetY, 0, w, h);

    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();

    // Target landing ring
    ctx.beginPath();
    ctx.ellipse(endPt.x, endPt.y, 18 * endPt.scale, 9 * endPt.scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Touch handlers for mobile / WeChat webview
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    if (controlMode === 'joystick') {
      // If touch is on bottom-left half, activate joystick fallback
      if (touchX < rect.width * 0.45 && touchY > rect.height * 0.45) {
        touchJoystick.current = {
          active: true,
          startX: touchX,
          startY: touchY,
          curX: touchX,
          curY: touchY,
        };
      }
    } else {
      // Touch / Swipe Mode: All bottom buttons hidden, screen accepts full swipe gestures
      touchStartRef.current = { x: touchX, y: touchY, time: performance.now() };

      // Move player towards touch horizontal location
      const courtX = ((touchX - rect.width * 0.5) / (rect.width * 0.45)) * COURT_HALF_WIDTH;
      playerRef.current.x = Math.max(-COURT_DOUBLES_HALF_WIDTH - 1.0, Math.min(COURT_DOUBLES_HALF_WIDTH + 1.0, courtX));

      // If waiting to serve, tap to serve immediately!
      if (gameStateRef.current === 'serving' && scoreRef.current.server === 'player') {
        handlePlayerSwingWithDirection('tap');
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    if (controlMode === 'joystick') {
      if (touchJoystick.current.active) {
        touchJoystick.current.curX = touchX;
        touchJoystick.current.curY = touchY;
      }
    } else if (controlMode === 'touch') {
      // Direct touch mode: move player horizontally with finger
      const courtX = ((touchX - rect.width * 0.5) / (rect.width * 0.45)) * COURT_HALF_WIDTH;
      playerRef.current.x = Math.max(-COURT_DOUBLES_HALF_WIDTH - 1.0, Math.min(COURT_DOUBLES_HALF_WIDTH + 1.0, courtX));

      // If in rally and incoming ball is in sweet spot while sliding to intercept, auto-swing!
      if (gameStateRef.current === 'rally' && ballRef.current.inPlay && !playerRef.current.isSwinging) {
        const b = ballRef.current;
        const p = playerRef.current;
        const distX = Math.abs(b.x - p.x);
        const distY = Math.abs(b.y - p.y);
        if (distX <= 1.8 && distY <= 1.8 && b.z >= 0.2 && b.z <= 2.8 && b.y > 6.0) {
          handlePlayerSwingWithDirection('tap');
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (controlMode === 'joystick') {
      touchJoystick.current.active = false;
      touchAim.current = null;
    } else if (controlMode === 'touch' && touchStartRef.current) {
      const touch = e.changedTouches?.[0];
      if (touch && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const endX = touch.clientX - rect.left;
        const endY = touch.clientY - rect.top;
        const dx = endX - touchStartRef.current.x;
        const dy = endY - touchStartRef.current.y;
        const dist = Math.hypot(dx, dy);

        if (dist >= 25) {
          // Directional swipe gesture on screen
          if (Math.abs(dy) > Math.abs(dx)) {
            handlePlayerSwingWithDirection(dy < 0 ? 'up' : 'down');
          } else {
            handlePlayerSwingWithDirection(dx > 0 ? 'right' : 'left');
          }
        } else {
          // Tap: Flat drive
          handlePlayerSwingWithDirection('tap');
        }
      }
      touchStartRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      id="tennis-canvas-container"
      className="relative w-full h-full select-none touch-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        id="tennis-game-canvas"
        className="w-full h-full block cursor-crosshair touch-none"
      />

      {/* Floating HUD Messages (ACE, OUT, FAULT, DEUCE) */}
      {hudMessage && (
        <div
          id="tennis-hud-message"
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 transition-transform duration-200 scale-100"
        >
          <div
            className="px-6 py-2.5 rounded-full font-black text-xl md:text-2xl tracking-wider shadow-2xl backdrop-blur-md border border-white/20"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: hudMessage.color,
              boxShadow: `0 0 25px ${hudMessage.color}55`,
            }}
          >
            {hudMessage.text}
          </div>
        </div>
      )}

      {/* Dynamic Technique Execution Display Banner */}
      <TechniqueDisplayBanner technique={activeTechnique} />

      {/* Virtual Joystick Mode: Show Bottom On-Screen Controls */}
      {controlMode === 'joystick' && (
        <>
          {/* Mobile Steering Helm for Lateral Left/Right Movement (Left Side, Semi-Transparent) */}
          <div
            id="tennis-mobile-helm-container"
            className="absolute bottom-5 left-4 md:bottom-6 md:left-6 z-20 pointer-events-auto"
          >
            <SteeringHelm
              onSteer={(val) => {
                helmInput.current = val;
              }}
            />
          </div>

          {/* Consolidated Mobile Action Swing Button (Right Side, Tap = Flat, Drag = Directional Techniques) */}
          <div
            id="tennis-mobile-action-container"
            className="absolute bottom-5 right-4 md:bottom-6 md:right-6 z-20 pointer-events-auto"
          >
            <ActionSwingButton
              isServing={gameStateRef.current === 'serving' && score.server === 'player'}
              onSwing={handlePlayerSwingWithDirection}
            />
          </div>
        </>
      )}

      {/* Touch / Swipe Mode: Minimal unobtrusive gesture hint */}
      {controlMode === 'touch' && (
        <div
          id="tennis-touch-mode-hint"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        >
          <div className="px-3.5 py-1 rounded-full bg-slate-900/60 backdrop-blur-sm border border-slate-700/40 text-slate-300 text-xs font-medium shadow-md">
            左右滑动移动 · 上下左右划屏击球
          </div>
        </div>
      )}
    </div>
  );
};
