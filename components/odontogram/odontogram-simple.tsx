"use client";

import { useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";

interface OdontogramSimpleProps {
  value?: number[];
  onChange?: (selectedTeeth: number[]) => void;
  className?: string;
  disabled?: boolean;
}

type ToothPosition = { 
  x: number; 
  y: number; 
  rotation: number; 
};

// Parámetros de la elipse
const ELLIPSE_CENTER_X = 400;
const ELLIPSE_CENTER_Y = 300;
const ELLIPSE_RX = 180; // Radio horizontal
const ELLIPSE_RY = 240; // Radio vertical

// Función para calcular posición en elipse
function calculateToothPosition(toothNumber: number): ToothPosition {
  // Determinar cuál cuadrante y posición dentro del cuadrante
  const quadrant = Math.floor(toothNumber / 10);
  const position = toothNumber % 10;
  
  // Ángulo base según el número de diente (0-8, donde 1-8 son las posiciones)
  // Para maxilar superior (cuadrantes 1 y 2): de 0° a 180°
  // Para mandíbula inferior (cuadrantes 3 y 4): de 180° a 360°
  
  let angle: number;
  
  if (quadrant === 1) {
    // Cuadrante 1 (derecho superior): posiciones 11-18
    // De 90° (frente) a 0° (derecha)
    angle = 90 - (position - 1) * (90 / 7);
  } else if (quadrant === 2) {
    // Cuadrante 2 (izquierdo superior): posiciones 21-28
    // De 90° (frente) a 180° (izquierda)
    angle = 90 + (position - 1) * (90 / 7);
  } else if (quadrant === 4) {
    // Cuadrante 4 (derecho inferior): posiciones 41-48
    // De 270° (frente abajo) a 360° (derecha)
    angle = 270 + (position - 1) * (90 / 7);
  } else {
    // Cuadrante 3 (izquierdo inferior): posiciones 31-38
    // De 270° (frente abajo) a 180° (izquierda)
    angle = 270 - (position - 1) * (90 / 7);
  }
  
  // Convertir ángulo a radianes
  const rad = (angle * Math.PI) / 180;
  
  // Calcular posición en la elipse
  const x = ELLIPSE_CENTER_X + ELLIPSE_RX * Math.cos(rad);
  const y = ELLIPSE_CENTER_Y + ELLIPSE_RY * Math.sin(rad);
  
  // Calcular rotación tangencial (perpendicular a la elipse)
  // La tangente a una elipse tiene pendiente: -(rx^2 * sin) / (ry^2 * cos)
  const dx = -ELLIPSE_RX * Math.sin(rad);
  const dy = ELLIPSE_RY * Math.cos(rad);
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return { x, y, rotation };
}

// Generar posiciones para todos los dientes
const TEETH_POSITIONS: Record<number, ToothPosition> = {};

// Maxilar superior
for (let i = 1; i <= 8; i++) {
  TEETH_POSITIONS[10 + i] = calculateToothPosition(10 + i);
  TEETH_POSITIONS[20 + i] = calculateToothPosition(20 + i);
}

// Mandíbula inferior
for (let i = 1; i <= 8; i++) {
  TEETH_POSITIONS[30 + i] = calculateToothPosition(30 + i);
  TEETH_POSITIONS[40 + i] = calculateToothPosition(40 + i);
}


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
          {/* Elipse de referencia (opcional, puedes comentarla) */}
          <ellipse
            cx={ELLIPSE_CENTER_X}
            cy={ELLIPSE_CENTER_Y}
            rx={ELLIPSE_RX}
            ry={ELLIPSE_RY}
            fill="none"
            stroke="#e5f3f4"
            strokeWidth={1.5}
            strokeDasharray="5,3"
          />

          {/* Línea divisoria central */}
          <line
            x1={400}
            y1={40}
            x2={400}
            y2={560}
            stroke="#d2f2f3"
            strokeWidth={2}
            strokeDasharray="8,5"
          />

          {/* Línea horizontal entre maxilar y mandíbula */}
          <line
            x1={180}
            y1={300}
            x2={620}
            y2={300}
            stroke="#d2f2f3"
            strokeWidth={2}
            strokeDasharray="8,5"
          />

          {/* Labels de cuadrantes */}
          <text x={480} y={160} className="text-xs fill-slate-400 font-medium">
            Cuadrante 1
          </text>
          <text x={240} y={160} className="text-xs fill-slate-400 font-medium">
            Cuadrante 2
          </text>
          <text x={240} y={450} className="text-xs fill-slate-400 font-medium">
            Cuadrante 3
          </text>
          <text x={480} y={450} className="text-xs fill-slate-400 font-medium">
            Cuadrante 4
          </text>

          {/* Maxilar Superior label */}
          <text x={320} y={50} className="text-sm fill-[#09919b] font-semibold">
            Maxilar Superior
          </text>

          {/* Mandíbula Inferior label */}
          <text x={310} y={560} className="text-sm fill-[#09919b] font-semibold">
            Mandíbula Inferior
          </text>

          {/* Renderizar dientes como rectángulos redondeados tangenciales */}
          {Object.entries(TEETH_POSITIONS).map(([toothNumber, position]) => {
            const selected = isSelected(Number(toothNumber));
            const quadrant = Math.floor(Number(toothNumber) / 10);
            const isUpper = quadrant === 1 || quadrant === 2;

            return (
              <g 
                key={toothNumber}
                transform={`translate(${position.x},${position.y}) rotate(${position.rotation})`}
              >
                {/* Rectángulo redondeado del diente */}
                <rect
                  x={-14}
                  y={-10}
                  width={28}
                  height={20}
                  rx={4}
                  fill={selected ? "#09919b" : "#ffffff"}
                  stroke={selected ? "#09919b" : "#b0dde0"}
                  strokeWidth={2.5}
                  onClick={() => toggleTooth(Number(toothNumber))}
                  className="cursor-pointer transition-all hover:stroke-[#09919b] hover:stroke-[3px]"
                  style={{ filter: selected ? 'drop-shadow(0 2px 4px rgba(9, 145, 155, 0.3))' : 'none' }}
                />

                {/* Número del diente dentro del rectángulo */}
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[11px] font-bold select-none pointer-events-none"
                  fill={selected ? "#ffffff" : "#64748b"}
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
