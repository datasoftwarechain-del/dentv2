"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToothSelection {
  number: number;
  workType?: string;
  notes?: string;
}

interface OdontogramProps {
  value?: ToothSelection[];
  onChange?: (selections: ToothSelection[]) => void;
  className?: string;
  disabled?: boolean;
}

// FDI Notation: 11-18 (upper right), 21-28 (upper left), 31-38 (lower left), 41-48 (lower right)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [38, 37, 36, 35, 34, 33, 32, 31];
const LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47, 48];

export function Odontogram({ value = [], onChange, className, disabled }: OdontogramProps) {
  const [selections, setSelections] = useState<ToothSelection[]>(value);

  const isSelected = (toothNumber: number) => {
    return selections.some(s => s.number === toothNumber);
  };

  const toggleTooth = (toothNumber: number) => {
    if (disabled) return;

    const newSelections = isSelected(toothNumber)
      ? selections.filter(s => s.number !== toothNumber)
      : [...selections, { number: toothNumber }];

    setSelections(newSelections);
    onChange?.(newSelections);
  };

  const Tooth = ({ number, quadrant }: { number: number; quadrant: 'upper' | 'lower' }) => {
    const selected = isSelected(number);

    return (
      <g
        className={cn(
          "cursor-pointer transition-all",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => toggleTooth(number)}
      >
        {/* Tooth shape */}
        <ellipse
          cx="20"
          cy="28"
          rx="16"
          ry="24"
          className={cn(
            "transition-all stroke-2",
            selected
              ? "fill-[#09919b] stroke-[#044c64]"
              : "fill-white stroke-slate-300 hover:fill-slate-50 hover:stroke-[#09919b]"
          )}
        />

        {/* Tooth number */}
        <text
          x="20"
          y="32"
          textAnchor="middle"
          className={cn(
            "text-xs font-bold select-none pointer-events-none",
            selected ? "fill-white" : "fill-slate-600"
          )}
        >
          {number}
        </text>

        {/* Selection indicator */}
        {selected && (
          <circle
            cx="20"
            cy="10"
            r="4"
            className="fill-[#43eada]"
          />
        )}
      </g>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox="0 0 700 400"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Upper arch */}
        <g>
          {/* Upper right quadrant (18-11) */}
          {UPPER_RIGHT.map((num, idx) => (
            <g key={num} transform={`translate(${280 + idx * 42}, 40)`}>
              <Tooth number={num} quadrant="upper" />
            </g>
          ))}

          {/* Upper left quadrant (21-28) */}
          {UPPER_LEFT.map((num, idx) => (
            <g key={num} transform={`translate(${40 + idx * 42}, 40)`}>
              <Tooth number={num} quadrant="upper" />
            </g>
          ))}

          {/* Upper arch curve */}
          <path
            d="M 50 95 Q 350 20, 650 95"
            fill="none"
            stroke="#d2f2f3"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </g>

        {/* Lower arch */}
        <g>
          {/* Lower left quadrant (38-31) */}
          {LOWER_LEFT.map((num, idx) => (
            <g key={num} transform={`translate(${40 + idx * 42}, 240)`}>
              <Tooth number={num} quadrant="lower" />
            </g>
          ))}

          {/* Lower right quadrant (41-48) */}
          {LOWER_RIGHT.map((num, idx) => (
            <g key={num} transform={`translate(${280 + idx * 42}, 240)`}>
              <Tooth number={num} quadrant="lower" />
            </g>
          ))}

          {/* Lower arch curve */}
          <path
            d="M 50 275 Q 350 350, 650 275"
            fill="none"
            stroke="#d2f2f3"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </g>

        {/* Center dividing line */}
        <line
          x1="350"
          y1="30"
          x2="350"
          y2="170"
          stroke="#e0f4f6"
          strokeWidth="2"
          strokeDasharray="2 2"
        />
        <line
          x1="350"
          y1="200"
          x2="350"
          y2="340"
          stroke="#e0f4f6"
          strokeWidth="2"
          strokeDasharray="2 2"
        />

        {/* Quadrant labels */}
        <text x="620" y="20" className="text-[10px] fill-slate-400 font-semibold">Cuadrante 1</text>
        <text x="40" y="20" className="text-[10px] fill-slate-400 font-semibold">Cuadrante 2</text>
        <text x="40" y="380" className="text-[10px] fill-slate-400 font-semibold">Cuadrante 3</text>
        <text x="620" y="380" className="text-[10px] fill-slate-400 font-semibold">Cuadrante 4</text>
      </svg>

      {/* Selected teeth summary */}
      {selections.length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-[#e0f4f6] border border-[#b0dde0]">
          <p className="text-xs font-bold uppercase tracking-wider text-[#09919b] mb-2">
            Piezas Seleccionadas ({selections.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selections.map(sel => (
              <div
                key={sel.number}
                className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 border border-[#09919b]/30"
              >
                <span className="text-sm font-bold text-[#044c64]">{sel.number}</span>
                {!disabled && (
                  <button
                    onClick={() => toggleTooth(sel.number)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
