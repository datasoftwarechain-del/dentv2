"use client";

import { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";

interface OdontogramSimpleProps {
  value?: number[];
  onChange?: (selectedTeeth: number[]) => void;
  className?: string;
  disabled?: boolean;
}

type ToothPosition = { x: number; y: number };

// Forma de herradura anatómica precisa
const TEETH_POSITIONS: Record<number, ToothPosition> = {
  // MAXILAR SUPERIOR - Forma de herradura amplia
  // Centro (incisivos centrales)
  11: { x: 380, y: 100 },
  21: { x: 420, y: 100 },

  // Incisivos laterales
  12: { x: 345, y: 105 },
  22: { x: 455, y: 105 },

  // Caninos (inicio de la curva)
  13: { x: 310, y: 120 },
  23: { x: 490, y: 120 },

  // Premolares (laterales)
  14: { x: 280, y: 145 },
  24: { x: 520, y: 145 },
  15: { x: 255, y: 175 },
  25: { x: 545, y: 175 },

  // Molares (parte posterior)
  16: { x: 235, y: 210 },
  26: { x: 565, y: 210 },
  17: { x: 220, y: 250 },
  27: { x: 580, y: 250 },
  18: { x: 210, y: 290 },
  28: { x: 590, y: 290 },

  // MANDÍBULA INFERIOR - Forma de herradura más estrecha
  // Centro (incisivos centrales)
  31: { x: 385, y: 500 },
  41: { x: 415, y: 500 },

  // Incisivos laterales
  32: { x: 355, y: 495 },
  42: { x: 445, y: 495 },

  // Caninos
  33: { x: 325, y: 485 },
  43: { x: 475, y: 485 },

  // Premolares
  34: { x: 295, y: 470 },
  44: { x: 505, y: 470 },
  35: { x: 270, y: 450 },
  45: { x: 530, y: 450 },

  // Molares
  36: { x: 250, y: 425 },
  46: { x: 550, y: 425 },
  37: { x: 235, y: 395 },
  47: { x: 565, y: 395 },
  38: { x: 225, y: 365 },
  48: { x: 575, y: 365 },
};

const OdontogramSimpleComponent = ({
  value = [],
  onChange,
  className,
  disabled = false,
}: OdontogramSimpleProps) => {
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>(value);

  const isSelected = useCallback(
    (toothNumber: number) => selectedTeeth.includes(toothNumber),
    [selectedTeeth]
  );

  const toggleTooth = useCallback(
    (toothNumber: number) => {
      if (disabled) return;

      const newSelection = isSelected(toothNumber)
        ? selectedTeeth.filter((n) => n !== toothNumber)
        : [...selectedTeeth, toothNumber];

      setSelectedTeeth(newSelection);
      onChange?.(newSelection);
    },
    [selectedTeeth, isSelected, onChange, disabled]
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-gradient-to-br from-[#f0fafb] to-white rounded-2xl p-10 border border-[#d2f2f3]">
        <svg
          viewBox="0 0 800 600"
          className="w-full mx-auto"
          style={{ maxWidth: "1000px" }}
        >
          {/* Línea divisoria central */}
          <line
            x1={400}
            y1={50}
            x2={400}
            y2={550}
            stroke="#d2f2f3"
            strokeWidth={2}
            strokeDasharray="8,5"
          />

          {/* Línea horizontal entre maxilar y mandíbula */}
          <line
            x1={150}
            y1={330}
            x2={650}
            y2={330}
            stroke="#d2f2f3"
            strokeWidth={2}
            strokeDasharray="8,5"
          />

          {/* Labels */}
          <text x={480} y={180} className="text-xs fill-slate-400 font-medium">
            Cuadrante 1
          </text>
          <text x={250} y={180} className="text-xs fill-slate-400 font-medium">
            Cuadrante 2
          </text>
          <text x={250} y={430} className="text-xs fill-slate-400 font-medium">
            Cuadrante 3
          </text>
          <text x={480} y={430} className="text-xs fill-slate-400 font-medium">
            Cuadrante 4
          </text>

          {/* Maxilar Superior label */}
          <text x={320} y={70} className="text-sm fill-[#09919b] font-semibold">
            Maxilar Superior
          </text>

          {/* Mandíbula Inferior label */}
          <text x={310} y={540} className="text-sm fill-[#09919b] font-semibold">
            Mandíbula Inferior
          </text>

          {/* Renderizar dientes */}
          {Object.entries(TEETH_POSITIONS).map(([toothNumber, position]) => {
            const selected = isSelected(Number(toothNumber));
            const quadrant = Math.floor(Number(toothNumber) / 10);
            const isUpper = quadrant === 1 || quadrant === 2;

            return (
              <g key={toothNumber}>
                {/* Círculo del diente */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={20}
                  fill={selected ? "#09919b" : "#ffffff"}
                  stroke={selected ? "#09919b" : "#b0dde0"}
                  strokeWidth={2.5}
                  onClick={() => toggleTooth(Number(toothNumber))}
                  className="cursor-pointer transition-all hover:stroke-[#09919b]"
                />

                {/* Número del diente */}
                <text
                  x={position.x}
                  y={isUpper ? position.y - 32 : position.y + 32}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-xs font-semibold select-none pointer-events-none"
                  fill="#64748b"
                >
                  {toothNumber}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Piezas seleccionadas */}
      {selectedTeeth.length > 0 && (
        <div className="mt-6 p-5 bg-[#e0f4f6] border border-[#b0dde0] rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#044c64] uppercase tracking-wider">
              Piezas seleccionadas
            </p>
            <span className="text-xs font-semibold text-[#09919b] bg-white px-2 py-1 rounded-full">
              {selectedTeeth.length} {selectedTeeth.length === 1 ? 'pieza' : 'piezas'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTeeth.sort((a, b) => a - b).map((tooth) => (
              <button
                key={tooth}
                onClick={() => toggleTooth(tooth)}
                className="inline-flex items-center justify-center min-w-[50px] px-3 py-2 bg-white border-2 border-[#09919b] rounded-lg hover:bg-[#09919b] hover:text-white transition-all"
              >
                <span className="text-sm font-bold text-[#044c64] group-hover:text-white">
                  {tooth}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Memoizar para evitar re-renders innecesarios
export const OdontogramSimple = memo(OdontogramSimpleComponent, (prevProps, nextProps) => {
  return (
    prevProps.disabled === nextProps.disabled &&
    prevProps.className === nextProps.className &&
    JSON.stringify(prevProps.value) === JSON.stringify(nextProps.value)
  );
});
