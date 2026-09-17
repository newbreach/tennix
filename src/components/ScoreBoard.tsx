import React from 'react';
import { CourtSurface, GameDifficulty, ScoreState } from '../types';

interface ScoreBoardProps {
  score: ScoreState;
  rallyCount: number;
  difficulty: GameDifficulty;
  surface: CourtSurface;
}

const formatPoint = (points: number, opponentPoints: number): string => {
  if (points === 4) return 'AD';
  if (opponentPoints === 4) return '40';
  if (points >= 3 && opponentPoints >= 3) return '40';

  switch (points) {
    case 0:
      return '0';
    case 1:
      return '15';
    case 2:
      return '30';
    case 3:
      return '40';
    default:
      return '0';
  }
};

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  score,
  rallyCount,
  difficulty,
  surface,
}) => {
  const surfaceLabel =
    surface === 'clay' ? '罗兰加洛斯·红土' : surface === 'grass' ? '温布尔登·草地' : '美网·硬地球场';

  const diffLabel = difficulty === 'easy' ? '新手' : difficulty === 'medium' ? '职业' : '大师';

  return (
    <div
      id="tennis-tv-scoreboard"
      className="w-full max-w-4xl mx-auto px-2 md:px-4 pt-1 pb-1 z-30 select-none"
    >
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/60 shadow-xl overflow-hidden">
        {/* Tournament & Surface Tag Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-slate-950/80 border-b border-slate-800 text-[11px] md:text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200 font-semibold tracking-wide">ITF 网球大奖赛</span>
            <span className="text-slate-500">|</span>
            <span className="text-amber-400 font-mono">{surfaceLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              AI难度: <span className="text-emerald-400 font-bold">{diffLabel}</span>
            </span>
            {rallyCount > 1 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                ⚡ 回合: {rallyCount}
              </span>
            )}
          </div>
        </div>

        {/* Players & Scores Grid */}
        <div className="grid grid-cols-1 divide-y divide-slate-800/80">
          {/* AI Row */}
          <div
            id="scoreboard-ai-row"
            className="flex items-center justify-between px-3 py-1.5 md:py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              {score.server === 'ai' ? (
                <span className="text-yellow-400 text-xs md:text-sm animate-bounce">🎾</span>
              ) : (
                <span className="w-3.5 md:w-4" />
              )}
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center text-[10px] md:text-xs font-black shadow-inner">
                AI
              </div>
              <span className="font-bold text-slate-100 text-xs md:text-sm tracking-wide truncate">
                电脑对手 (AI Player)
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4 font-mono text-xs md:text-sm">
              {/* Sets */}
              <div className="w-7 text-center font-bold text-slate-400 bg-slate-800/50 py-0.5 rounded">
                {score.aiSets}
              </div>
              {/* Games */}
              <div className="w-8 text-center font-black text-slate-200 bg-slate-800/90 py-0.5 rounded text-sm md:text-base border border-slate-700">
                {score.aiGames}
              </div>
              {/* Points */}
              <div className="w-12 md:w-14 text-center font-black text-amber-300 bg-amber-950/40 border border-amber-500/40 py-0.5 rounded text-sm md:text-base">
                {formatPoint(score.aiPoints, score.playerPoints)}
              </div>
            </div>
          </div>

          {/* Player Row */}
          <div
            id="scoreboard-player-row"
            className="flex items-center justify-between px-3 py-1.5 md:py-2 hover:bg-white/5 transition-colors bg-blue-950/20"
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              {score.server === 'player' ? (
                <span className="text-yellow-400 text-xs md:text-sm animate-bounce">🎾</span>
              ) : (
                <span className="w-3.5 md:w-4" />
              )}
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-600/90 text-white flex items-center justify-center text-[10px] md:text-xs font-black shadow-inner">
                我
              </div>
              <span className="font-bold text-blue-300 text-xs md:text-sm tracking-wide truncate">
                玩家 (Player)
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4 font-mono text-xs md:text-sm">
              {/* Sets */}
              <div className="w-7 text-center font-bold text-slate-400 bg-slate-800/50 py-0.5 rounded">
                {score.playerSets}
              </div>
              {/* Games */}
              <div className="w-8 text-center font-black text-slate-200 bg-slate-800/90 py-0.5 rounded text-sm md:text-base border border-slate-700">
                {score.playerGames}
              </div>
              {/* Points */}
              <div className="w-12 md:w-14 text-center font-black text-amber-300 bg-amber-950/40 border border-amber-500/40 py-0.5 rounded text-sm md:text-base">
                {formatPoint(score.playerPoints, score.aiPoints)}
              </div>
            </div>
          </div>
        </div>

        {/* Status / Serving side indicator */}
        <div className="flex items-center justify-between px-3 py-1 bg-slate-950/90 text-[10px] md:text-xs text-slate-400 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span>
              发球方:{' '}
              <strong className={score.server === 'player' ? 'text-blue-400' : 'text-red-400'}>
                {score.server === 'player' ? '玩家' : '电脑'}
              </strong>
            </span>
            <span>•</span>
            <span>
              发球区: <strong>{score.currentServeSide === 'deuce' ? '平分半区(右)' : '占先半区(左)'}</strong>
            </span>
          </div>
          {score.isDeuce && (
            <span className="text-yellow-400 font-bold tracking-wider animate-pulse">
              DEUCE (平分)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
