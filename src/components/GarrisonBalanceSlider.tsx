import React, { useRef, useState } from 'react';
import '../styles/GarrisonBalanceSlider.css';

interface GarrisonBalanceSliderProps {
  min: number;
  max: number;
  value: number;
  /** Fires continuously while dragging (and on a plain click-to-jump), for
   * live label updates — not yet validated against game rules, that only
   * happens on commit. */
  onPreview: (value: number) => void;
  /** Fires once the drag ends (or right after a click-to-jump) with the
   * final value to actually apply. */
  onCommit: (value: number) => void;
}

/**
 * A fully custom-styled (no native <input type="range">) horizontal slider:
 * drag the thumb, or click/tap anywhere on the track to jump straight there.
 */
export const GarrisonBalanceSlider: React.FC<GarrisonBalanceSliderProps> = ({
  min,
  max,
  value,
  onPreview,
  onCommit,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const valueFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || max <= min) return value;
    const rect = track.getBoundingClientRect();
    const pct = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return Math.round(min + Math.max(0, Math.min(1, pct)) * (max - min));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    onPreview(valueFromClientX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onPreview(valueFromClientX(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    onCommit(valueFromClientX(e.clientX));
  };

  const pct = max > min ? ((Math.max(min, Math.min(max, value)) - min) / (max - min)) * 100 : 0;

  return (
    <div
      className={'garrison-slider' + (dragging ? ' garrison-slider-dragging' : '')}
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="garrison-slider-track">
        <div className="garrison-slider-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="garrison-slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
};

export default GarrisonBalanceSlider;
