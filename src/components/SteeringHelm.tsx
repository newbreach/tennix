import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SteeringHelmProps {
  onSteer: (x: number, y: number) => void; // -1 to 1 for both axes: x (left/right), y (up/down)
  className?: string;
}

export const SteeringHelm: React.FC<SteeringHelmProps> = ({ onSteer, className = '' }) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // -1 to 1
  const [isActive, setIsActive] = useState<boolean>(false);
  const activePointerId = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Maximum radius in pixels for knob displacement from center
  const MAX_RADIUS = 36;

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!padRef.current) return;
      const rect = padRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const dist = Math.hypot(rawDx, rawDy);

      let clampedDx = rawDx;
      let clampedDy = rawDy;

      if (dist > MAX_RADIUS) {
        clampedDx = (rawDx / dist) * MAX_RADIUS;
        clampedDy = (rawDy / dist) * MAX_RADIUS;
      }

      const normX = clampedDx / MAX_RADIUS; // -1 to +1
      const normY = clampedDy / MAX_RADIUS; // -1 to +1

      // Responsive steering curves for agile court repositioning
      const respX = Math.sign(normX) * Math.min(1, Math.pow(Math.abs(normX), 0.85) * 1.12);
      const respY = Math.sign(normY) * Math.min(1, Math.pow(Math.abs(normY), 0.85) * 1.12);

      setOffset({ x: normX, y: normY });
      onSteer(respX, respY);
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
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive || activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId && activePointerId.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    setIsActive(false);
    activePointerId.current = null;

    // Smooth return to center with prompt responsive braking
    const returnToCenter = () => {
      setOffset((prev) => {
        const nextX = Math.abs(prev.x) < 0.08 ? 0 : prev.x * 0.45;
        const nextY = Math.abs(prev.y) < 0.08 ? 0 : prev.y * 0.45;

        if (nextX === 0 && nextY === 0) {
          onSteer(0, 0);
          return { x: 0, y: 0 };
        }

        onSteer(nextX, nextY);
        animFrameRef.current = requestAnimationFrame(returnToCenter);
        return { x: nextX, y: nextY };
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

  // Direction active states based on current offset
  const isUpActive = offset.y < -0.22;
  const isDownActive = offset.y > 0.22;
  const isLeftActive = offset.x < -0.22;
  const isRightActive = offset.x > 0.22;

  return (
    <div
      id="tennis-steering-helm"
      ref={padRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative select-none touch-none w-28 h-28 md:w-32 md:h-32 rounded-full bg-slate-900/40 backdrop-blur-[4px] border-2 shadow-2xl flex items-center justify-center transition-colors duration-150 cursor-grab active:cursor-grabbing ${
        isActive
          ? 'border-cyan-400/80 bg-slate-900/60 shadow-cyan-500/20'
          : 'border-white/20 hover:border-white/35 hover:bg-slate-900/50'
      } ${className}`}
      title="上下左右方向舵 (全向拖拽控制球员走位)"
    >
      {/* Directional Guides / Crosshairs in background */}
      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-[1px] bg-white/10 pointer-events-none" />
      <div className="absolute inset-y-3 left-1/2 -translate-x-1/2 w-[1px] bg-white/10 pointer-events-none" />
      <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />

      {/* UP Arrow ▲ */}
      <div
        id="helm-arrow-up"
        className={`absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none transition-all duration-100 ${
          isUpActive
            ? 'text-cyan-300 scale-125 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]'
            : 'text-slate-400/60'
        }`}
      >
        <span className="text-base md:text-lg leading-none select-none">▲</span>
      </div>

      {/* DOWN Arrow ▼ */}
      <div
        id="helm-arrow-down"
        className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none transition-all duration-100 ${
          isDownActive
            ? 'text-cyan-300 scale-125 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]'
            : 'text-slate-400/60'
        }`}
      >
        <span className="text-base md:text-lg leading-none select-none">▼</span>
      </div>

      {/* LEFT Arrow ◀ */}
      <div
        id="helm-arrow-left"
        className={`absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-100 ${
          isLeftActive
            ? 'text-cyan-300 scale-125 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]'
            : 'text-slate-400/60'
        }`}
      >
        <span className="text-base md:text-lg leading-none select-none">◀</span>
      </div>

      {/* RIGHT Arrow ▶ */}
      <div
        id="helm-arrow-right"
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-100 ${
          isRightActive
            ? 'text-cyan-300 scale-125 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]'
            : 'text-slate-400/60'
        }`}
      >
        <span className="text-base md:text-lg leading-none select-none">▶</span>
      </div>

      {/* Center Draggable Knob / Rudder Hub */}
      <div
        id="tennis-steering-knob"
        className="absolute w-11 h-11 rounded-full bg-gradient-to-b from-slate-700/95 to-slate-900/95 border-2 border-cyan-400 shadow-md shadow-cyan-500/25 flex items-center justify-center pointer-events-none will-change-transform"
        style={{
          transform: `translate(${offset.x * MAX_RADIUS}px, ${offset.y * MAX_RADIUS}px)`,
        }}
      >
        {/* Core Jewel / Gripping Ring */}
        <div className="w-5 h-5 rounded-full border border-cyan-300/40 flex items-center justify-center">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
              isActive
                ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] scale-110'
                : 'bg-cyan-300/80'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
