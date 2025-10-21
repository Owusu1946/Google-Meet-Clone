"use client";
import React from "react";

interface CaptionsOverlayProps {
  lines: string[];
  interimText: string;
}

const CaptionsOverlay = ({ lines, interimText }: CaptionsOverlayProps) => {
  const hasContent = interimText || lines.length > 0;

  return (
    <div className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 bottom-24 w-[min(980px,94svw)] px-4">
      <div
        className={
          "w-full rounded-2xl bg-[rgba(12,12,12,0.55)] ring-1 ring-white/10 backdrop-blur-md text-white px-5 py-3 md:px-6 md:py-3.5 leading-relaxed shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition-all duration-200"
        }
      >
        <div className="text-[15px] md:text-[16px] tracking-[0.005em] space-y-1.5 md:space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="opacity-80">
              {l}
            </div>
          ))}
          {interimText && (
            <div className="opacity-100">
              <span className="animate-pulse opacity-70 mr-1">•</span>
              {interimText}
            </div>
          )}
          {!hasContent && (
            <div className="opacity-50">Captions will appear here…</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptionsOverlay;
