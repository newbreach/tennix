import React, { useState } from 'react';
import { Volume2, VolumeX, Pause, Play, RotateCcw, Smartphone, Settings2, HelpCircle } from 'lucide-react';
import { ControlMode, CourtSurface, GameDifficulty } from '../types';
import { soundManager } from '../utils/audio';

interface GameControlsProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  surface: CourtSurface;
  onSurfaceChange: (surface: CourtSurface) => void;
  difficulty: GameDifficulty;
  onDifficultyChange: (diff: GameDifficulty) => void;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
  onOpenHelp: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  isPaused,
  onTogglePause,
  onRestart,
  surface,
  onSurfaceChange,
  difficulty,
  onDifficultyChange,
  controlMode,
  onControlModeChange,
  onOpenHelp,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isSoundEnabled());
  const [showSettings, setShowSettings] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
  };

  return (
    <>
      {/* Top Floating Control Bar */}
      <div
        id="tennis-top-bar"
        className="w-full max-w-4xl mx-auto px-2 md:px-4 py-1.5 flex items-center justify-between z-30 select-none"
      >
        <div className="flex items-center gap-1.5">
          <button
            id="btn-toggle-pause"
            onClick={onTogglePause}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/60 shadow transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title={isPaused ? '继续比赛' : '暂停'}
          >
            {isPaused ? <Play size={16} className="text-emerald-400" /> : <Pause size={16} className="text-amber-400" />}
            <span className="hidden sm:inline">{isPaused ? '继续' : '暂停'}</span>
          </button>

          <button
            id="btn-restart-match"
            onClick={onRestart}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/60 shadow transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="重新开局"
          >
            <RotateCcw size={16} className="text-blue-400" />
            <span className="hidden sm:inline">重开</span>
          </button>

          <button
            id="btn-toggle-sound"
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/60 shadow transition-colors text-xs font-semibold cursor-pointer"
            title={soundEnabled ? '关闭音效' : '开启音效'}
          >
            {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-slate-400" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Mode Toggle */}
          <button
            id="btn-toggle-control-mode"
            onClick={() => onControlModeChange(controlMode === 'touch' ? 'joystick' : 'touch')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/60 shadow transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="切换操控模式"
          >
            <Smartphone size={14} className="text-cyan-400" />
            <span>{controlMode === 'touch' ? '滑动触控' : '虚拟摇杆'}</span>
          </button>

          {/* Settings Modal Toggle */}
          <button
            id="btn-open-settings"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/60 shadow transition-colors cursor-pointer"
            title="场地与难度设置"
          >
            <Settings2 size={16} className="text-purple-400" />
          </button>

          {/* WeChat Mini Program / Help Guide */}
          <button
            id="btn-open-wechat-guide"
            onClick={onOpenHelp}
            className="p-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 active:scale-95 text-emerald-300 border border-emerald-600/50 shadow transition-colors cursor-pointer"
            title="微信小程序嵌入指南"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* Settings Dialog Dropdown */}
      {showSettings && (
        <div
          id="tennis-settings-panel"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Settings2 size={18} className="text-purple-400" /> 游戏与球场设置
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* AI Difficulty */}
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1.5 block">AI 难度等级</label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => onDifficultyChange(d)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      difficulty === d
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border border-blue-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {d === 'easy' ? '新手 (Casual)' : d === 'medium' ? '职业 (Club)' : '大师 (Pro)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Surface */}
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1.5 block">场地类型</label>
              <div className="grid grid-cols-3 gap-2">
                {(['hard', 'clay', 'grass'] as CourtSurface[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => onSurfaceChange(s)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      surface === s
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30 border border-amber-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {s === 'hard' ? '美网硬地' : s === 'clay' ? '法网红土' : '温网草地'}
                  </button>
                ))}
              </div>
            </div>

            {/* Control mode */}
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1.5 block">移动操作模式</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onControlModeChange('touch')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    controlMode === 'touch'
                      ? 'bg-emerald-600 text-white shadow-lg border border-emerald-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  手指拖拽跟随 (推荐)
                </button>
                <button
                  onClick={() => onControlModeChange('joystick')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    controlMode === 'joystick'
                      ? 'bg-emerald-600 text-white shadow-lg border border-emerald-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  虚拟摇杆按键
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
            >
              完成并返回比赛
            </button>
          </div>
        </div>
      )}
    </>
  );
};
