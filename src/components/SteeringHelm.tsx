import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SteeringHelmProps {
  onSteer: (value: number) => void; // -1 (left) to +1 (right), 0 (neutral)
  className?: string;
}

export const SteeringHelm: React.FC<SteeringHelmProps> = ({ onSteer, className = '' }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<number>(0); // -1 to 1
  const [isActive, setIsActive] = useState<boolean>(false);
  const activePointerId = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const targetOffsetRef = useRef<number>(0);

  // Update offset with smooth damping
  const updatePosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const halfWidth = (rect.width - 44) / 2; // Subtract knob size

      const rawDelta = clientX - centerX;
      const clampedDelta = Math.max(-halfWidth, Math.min(halfWidth, rawDelta));
      const normalized = clampedDelta / halfWidth; // -1 to +1

      // Responsive steering curve: slight thumb nudges provide strong, agile lateral movement
      const sign = Math.sign(normalized);
      const absVal = Math.abs(normalized);
      const responsiveValue = sign * Math.min(1, Math.pow(absVal, 0.85) * 1.15);

      setOffset(normalized);
      targetOffsetRef.current = normalized;
      onSteer(responsiveValue);
    },
    [onSteer]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActive(true);
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive || activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId && activePointerId.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    setIsActive(false);
    activePointerId.current = null;

    // Smooth return to center with prompt braking
    const returnToCenter = () => {
      setOffset((prev) => {
        if (Math.abs(prev) < 0.08) {
          onSteer(0);
          return 0;
        }
        const next = prev * 0.45;
        onSteer(next);
        animFrameRef.current = requestAnimationFrame(returnToCenter);
        return next;
      });
    };
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(returnToCenter);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div
      id="tennis-steering-helm"
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative select-none touch-none h-13 w-48 md:w-56 rounded-full bg-slate-900/35 backdrop-blur-[3px] border border-white/20 shadow-lg flex items-center justify-between px-3 cursor-ew-resize transition-all duration-150 ${
        isActive ? 'border-cyan-400/60 bg-slate-900/50 shadow-cyan-500/15' : 'hover:bg-slate-900/40'
      } ${className}`}
      title="左右移动舵 (左右拖拽或滑动控制角色)"
    >
      {/* Left Steering Indicator */}
      <div
        className={`flex items-center gap-1 text-xs font-bold transition-colors pointer-events-none ${
          offset < -0.2 ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400/70'
        }`}
      >
        <span className="text-sm">◀</span>
        <span className="text-[11px] tracking-wider">左移</span>
      </div>

      {/* Center Neutral Notch */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/25 rounded-full pointer-events-none" />

      {/* Right Steering Indicator */}
      <div
        className={`flex items-center gap-1 text-xs font-bold transition-colors pointer-events-none ${
          offset > 0.2 ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400/70'
        }`}
      >
        <span className="text-[11px] tracking-wider">右移</span>
        <span className="text-sm">▶</span>
      </div>

      {/* Draggable Steering Knob / Rudder Dial */}
      <div
        id="tennis-steering-knob"
        className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-b from-slate-700/90 to-slate-900/90 border-2 border-cyan-400/80 shadow-md shadow-cyan-500/20 flex items-center justify-center pointer-events-none transition-transform"
        style={{
          left: `calc(50% + ${offset * 38}% - 20px)`,
        }}
      >
        {/* Grip ridges / Rudder icon */}
        <div className="w-5 h-5 rounded-full border border-cyan-300/40 flex items-center justify-center">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isActive ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-cyan-300/80'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
