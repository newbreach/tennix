import React from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { MatchStats } from '../types';

interface MatchOverModalProps {
  winner: 'player' | 'ai';
  stats: MatchStats;
  onRestart: () => void;
}

export const MatchOverModal: React.FC<MatchOverModalProps> = ({
  winner,
  stats,
  onRestart,
}) => {
  const isPlayerWinner = winner === 'player';

  return (
    <div
      id="tennis-match-over-modal"
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center shadow-inner border border-white/20 bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950">
          <Trophy size={32} />
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-wide">
            {isPlayerWinner ? '🏆 恭喜获得胜利！' : '比赛结束'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isPlayerWinner ? '你击败了电脑选手，夺得冠军！' : '电脑选手赢下了这场对决，再接再厉！'}
          </p>
        </div>

        {/* Match Statistics Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs md:text-sm">
          <div className="grid grid-cols-3 font-semibold text-slate-400 border-b border-slate-800 pb-2 mb-2">
            <span className="text-blue-400 font-bold">玩家</span>
            <span className="text-slate-500">比赛统计</span>
            <span className="text-red-400 font-bold">电脑</span>
          </div>

          <div className="space-y-2.5 font-mono">
            <div className="grid grid-cols-3 items-center">
              <span className="text-slate-200 font-bold">{stats.aces.player}</span>
              <span className="text-slate-400 font-sans text-xs">Ace球</span>
              <span className="text-slate-200 font-bold">{stats.aces.ai}</span>
            </div>
            <div className="grid grid-cols-3 items-center">
              <span className="text-slate-200 font-bold">{stats.totalPointsWon.player}</span>
              <span className="text-slate-400 font-sans text-xs">总得分数</span>
              <span className="text-slate-200 font-bold">{stats.totalPointsWon.ai}</span>
            </div>
            <div className="grid grid-cols-3 items-center">
              <span className="text-slate-200 font-bold">{stats.longestRally} 拍</span>
              <span className="text-slate-400 font-sans text-xs">最长回合</span>
              <span className="text-slate-200 font-bold">{stats.longestRally} 拍</span>
            </div>
          </div>
        </div>

        <button
          id="btn-modal-restart"
          onClick={onRestart}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transform active:scale-95 transition-all text-sm md:text-base cursor-pointer"
        >
          <RotateCcw size={18} />
          <span>再来一局 (Play Again)</span>
        </button>
      </div>
    </div>
  );
};
