import React, { useEffect, useState } from 'react';
import { TechniqueFeedback } from '../types';

interface TechniqueDisplayBannerProps {
  technique: TechniqueFeedback | null;
}

export const TechniqueDisplayBanner: React.FC<TechniqueDisplayBannerProps> = ({ technique }) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [current, setCurrent] = useState<TechniqueFeedback | null>(null);

  useEffect(() => {
    if (technique) {
      setCurrent(technique);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [technique]);

  if (!visible || !current) return null;

  return (
    <div
      id="tennis-technique-banner"
      className="absolute bottom-22 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300 transform scale-100 animate-in fade-in zoom-in-95"
    >
      <div
        className="px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md border border-white/25 flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          boxShadow: `0 0 24px ${current.color}44, 0 8px 16px rgba(0,0,0,0.5)`,
          borderLeft: `4px solid ${current.color}`,
        }}
      >
        {/* Technique Icon */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
          style={{
            backgroundColor: `${current.color}25`,
            color: current.color,
          }}
        >
          {current.icon}
        </div>

        {/* Text descriptions */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white tracking-wide">{current.name}</span>
            <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
              {current.enName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300/90 font-medium">
            <span style={{ color: current.color }}>{current.description}</span>
            <span className="text-slate-500">•</span>
            <span className="font-mono text-emerald-400 font-bold">{current.speedKmh} km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
};
