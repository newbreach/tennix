/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { GameControls } from './components/GameControls';
import { MatchOverModal } from './components/MatchOverModal';
import { ScoreBoard } from './components/ScoreBoard';
import { TennisCanvas } from './game/TennisCanvas';
import { ControlMode, CourtSurface, GameDifficulty, MatchStats, ScoreState } from './types';
import { soundManager } from './utils/audio';

const INITIAL_SCORE: ScoreState = {
  playerPoints: 0,
  aiPoints: 0,
  playerGames: 0,
  aiGames: 0,
  playerSets: 0,
  aiSets: 0,
  isDeuce: false,
  server: 'player',
  currentServeSide: 'deuce',
  faultCount: 0,
  history: [],
};

const INITIAL_STATS: MatchStats = {
  aces: { player: 0, ai: 0 },
  doubleFaults: { player: 0, ai: 0 },
  winners: { player: 0, ai: 0 },
  totalPointsWon: { player: 0, ai: 0 },
  longestRally: 0,
  currentRally: 0,
};

export default function App() {
  const [surface, setSurface] = useState<CourtSurface>('clay');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('medium');
  const [controlMode, setControlMode] = useState<ControlMode>('joystick');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [score, setScore] = useState<ScoreState>(INITIAL_SCORE);
  const [stats, setStats] = useState<MatchStats>(INITIAL_STATS);
  const [gameOverWinner, setGameOverWinner] = useState<'player' | 'ai' | null>(null);
  const [matchKey, setMatchKey] = useState<number>(0);

  const handleRestart = useCallback(() => {
    setScore({
      ...INITIAL_SCORE,
      history: [],
    });
    setStats({
      aces: { player: 0, ai: 0 },
      doubleFaults: { player: 0, ai: 0 },
      winners: { player: 0, ai: 0 },
      totalPointsWon: { player: 0, ai: 0 },
      longestRally: 0,
      currentRally: 0,
    });
    setGameOverWinner(null);
    setIsPaused(false);
    setMatchKey((prev) => prev + 1);
    soundManager.playWhistle();
  }, []);

  const handleScoreUpdate = useCallback((newScore: ScoreState) => {
    setScore(newScore);
  }, []);

  const handleGameOver = useCallback((winner: 'player' | 'ai') => {
    setGameOverWinner(winner);
  }, []);

  return (
    <div
      id="app-root-container"
      className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Top Header: Scoreboard & Controls */}
      <header id="app-header" className="relative z-30 w-full flex flex-col shrink-0 bg-slate-950/75 backdrop-blur-sm border-b border-slate-800/80">
        <ScoreBoard
          score={score}
          rallyCount={stats.currentRally}
          difficulty={difficulty}
          surface={surface}
        />
        <GameControls
          isPaused={isPaused}
          onTogglePause={() => setIsPaused((prev) => !prev)}
          onRestart={handleRestart}
          surface={surface}
          onSurfaceChange={setSurface}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          controlMode={controlMode}
          onControlModeChange={setControlMode}
        />
      </header>

      {/* Main Tennis Court View */}
      <main id="app-main-court" className="relative flex-1 w-full h-full overflow-hidden">
        <TennisCanvas
          key={matchKey}
          surface={surface}
          difficulty={difficulty}
          controlMode={controlMode}
          isPaused={isPaused || gameOverWinner !== null}
          score={score}
          onScoreUpdate={handleScoreUpdate}
          stats={stats}
          onStatsUpdate={setStats}
          onGameOver={handleGameOver}
        />
      </main>

      {/* Match Over Modal */}
      {gameOverWinner && (
        <MatchOverModal
          winner={gameOverWinner}
          stats={stats}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
