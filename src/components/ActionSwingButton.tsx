import React, { useState, useRef, useCallback } from 'react';
import { SwingDirection } from '../types';

interface ActionSwingButtonProps {
  isServing: boolean;
  onSwing: (direction: SwingDirection) => void;
  className?: string;
}

export const ActionSwingButton: React.FC<ActionSwingButtonProps> = ({
  isServing,
  onSwing,
  className = '',
}) => {
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [activeDir, setActiveDir] = useState<SwingDirection>('tap');
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startTimeRef = useRef<number>(0);
  const activePointerId = useRef<number | null>(null);

  // Compute direction from drag delta
  const computeDirection = (dx: number, dy: number): SwingDirection => {
    const dist = Math.hypot(dx, dy);
    if (dist < 18) return 'tap';

    if (Math.abs(dy) >= Math.abs(dx)) {
      return dy < 0 ? 'up' : 'down';
    } else {
      return dx < 0 ? 'left' : 'right';
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPressing(true);
    setActiveDir('tap');
    setDragOffset({ x: 0, y: 0 });
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    activePointerId.current = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPressing || activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    // Cap visual drag offset
    const maxDrag = 48;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxDrag, dist);
    const angle = Math.atan2(dy, dx);

    setDragOffset({
      x: dist === 0 ? 0 : Math.cos(angle) * clampedDist,
      y: dist === 0 ? 0 : Math.sin(angle) * clampedDist,
    });

    const dir = computeDirection(dx, dy);
    setActiveDir(dir);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPressing || (activePointerId.current !== null && activePointerId.current !== e.pointerId)) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const duration = Date.now() - startTimeRef.current;
    const dist = Math.hypot(dx, dy);

    let chosenDir: SwingDirection = 'tap';
    // Tap condition: released quickly (<220ms) or tiny movement (<18px)
    if (duration < 220 || dist < 18) {
      chosenDir = 'tap';
    } else {
      chosenDir = computeDirection(dx, dy);
    }

    onSwing(chosenDir);

    setIsPressing(false);
    setActiveDir('tap');
    setDragOffset({ x: 0, y: 0 });
    activePointerId.current = null;
  };

  const getDirectionDetails = (dir: SwingDirection) => {
    switch (dir) {
      case 'up':
        return { label: '⚡ 强力上旋 / 扣杀', color: 'text-amber-300', bg: 'bg-amber-500/80 border-amber-300' };
      case 'down':
        return { label: '🎯 战术切削放短', color: 'text-orange-300', bg: 'bg-orange-500/80 border-orange-300' };
      case 'left':
        return { label: '🚀 左角大斜线', color: 'text-purple-300', bg: 'bg-purple-500/80 border-purple-300' };
      case 'right':
        return { label: '⚡ 右线穿透球', color: 'text-cyan-300', bg: 'bg-cyan-500/80 border-cyan-300' };
      case 'tap':
      default:
        return { label: isServing ? '🎾 标准发球' : '💥 标准平击球', color: 'text-emerald-300', bg: 'bg-emerald-500/80 border-emerald-300' };
    }
  };

  const currentDetails = getDirectionDetails(activeDir);

  return (
    <div id="tennis-action-swing-container" className={`relative select-none touch-none ${className}`}>
      {/* 4-Way Directional Technique HUD (Revealed when holding/dragging) */}
      {isPressing && (
        <div
          id="tennis-directional-radial-hud"
          className="absolute -top-34 left-1/2 -translate-x-1/2 w-64 pointer-events-none flex flex-col items-center z-30 transition-opacity duration-150 animate-fade-in"
        >
          {/* Active selected technique banner */}
          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-black shadow-xl backdrop-blur-md border ${currentDetails.bg} text-white whitespace-nowrap mb-2 flex items-center gap-1.5 transition-all transform scale-105`}
          >
            <span>{currentDetails.label}</span>
          </div>

          {/* Compass layout of available gestures */}
          <div className="relative w-36 h-24 flex items-center justify-center">
            {/* UP: Topspin / Smash */}
            <div
              className={`absolute top-0 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                activeDir === 'up'
                  ? 'bg-amber-500 text-slate-950 border-white scale-110 shadow-lg shadow-amber-500/50'
                  : 'bg-slate-900/70 text-amber-300/80 border-amber-500/30'
              }`}
            >
              ▲ 上旋/扣杀
            </div>

            {/* DOWN: Slice */}
            <div
              className={`absolute bottom-0 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                activeDir === 'down'
                  ? 'bg-orange-500 text-slate-950 border-white scale-110 shadow-lg shadow-orange-500/50'
                  : 'bg-slate-900/70 text-orange-300/80 border-orange-500/30'
              }`}
            >
              ▼ 战术切削
            </div>

            {/* LEFT: Cross Court */}
            <div
              className={`absolute left-0 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                activeDir === 'left'
                  ? 'bg-purple-500 text-white border-white scale-110 shadow-lg shadow-purple-500/50'
                  : 'bg-slate-900/70 text-purple-300/80 border-purple-500/30'
              }`}
            >
              ◀ 左斜线
            </div>

            {/* RIGHT: Down The Line */}
            <div
              className={`absolute right-0 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                activeDir === 'right'
                  ? 'bg-cyan-500 text-slate-950 border-white scale-110 shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-900/70 text-cyan-300/80 border-cyan-500/30'
              }`}
            >
              右直线 ▶
            </div>

            {/* Center: Tap icon */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border ${
                activeDir === 'tap'
                  ? 'bg-emerald-400 text-slate-950 font-bold border-white'
                  : 'bg-slate-800/80 text-slate-300 border-white/20'
              }`}
            >
              ●
            </div>
          </div>
        </div>
      )}

      {/* Main Single Master Swing Button */}
      <div
        id="tennis-btn-master-swing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-18 h-18 md:w-20 md:h-20 rounded-full cursor-pointer shadow-2xl flex flex-col items-center justify-center transition-all transform active:scale-95 ${
          isPressing
            ? 'bg-gradient-to-tr from-amber-600 to-yellow-400 scale-95 border-3 border-white shadow-amber-500/50'
            : isServing
            ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 border-2 border-yellow-200/80 shadow-yellow-500/30'
            : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 border-2 border-white/40 shadow-blue-500/30 hover:brightness-110'
        }`}
        style={{
          boxShadow: isPressing
            ? '0 0 25px rgba(245, 158, 11, 0.6), 0 8px 16px rgba(0,0,0,0.4)'
            : '0 8px 24px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4)',
        }}
      >
        {/* Pulsing ring hint when idle */}
        {!isPressing && (
          <div className="absolute inset-0 rounded-full border-2 border-yellow-400/40 animate-ping pointer-events-none opacity-40" />
        )}

        {/* Inner Knob when dragged */}
        <div
          className="flex flex-col items-center justify-center pointer-events-none transition-transform"
          style={{
            transform: `translate(${dragOffset.x * 0.4}px, ${dragOffset.y * 0.4}px)`,
          }}
        >
          <span className="text-2xl md:text-3xl leading-none drop-shadow">
            {isServing ? '🎾' : isPressing ? (activeDir === 'up' ? '⚡' : activeDir === 'down' ? '🎯' : activeDir === 'left' ? '🚀' : activeDir === 'right' ? '⚡' : '💥') : '🎾'}
          </span>
          <span className="text-[11px] md:text-xs font-black tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-0.5">
            {isServing ? '发球' : isPressing ? '滑动变招' : '击球'}
          </span>
        </div>

        {/* Micro hint for gesture control */}
        <div className="absolute -bottom-5 text-[9px] font-bold text-slate-300/80 tracking-tight whitespace-nowrap bg-slate-900/60 px-1.5 py-0.5 rounded-full border border-white/10 pointer-events-none">
          点按平击 · 拖拽变招
        </div>
      </div>
    </div>
  );
};
