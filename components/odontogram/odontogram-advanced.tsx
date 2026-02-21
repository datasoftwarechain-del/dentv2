"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type ToothState =
  | "sano"
  | "caries"
  | "obturacion"
  | "ausente"
  | "corona"
  | "endodoncia"
  | "extraccion";

export interface ToothData {
  number: number;
  state: ToothState;
  notes?: string;
}

interface OdontogramAdvancedProps {
  value?: ToothData[];
  onChange?: (teeth: ToothData[]) => void;
  className?: string;
  disabled?: boolean;
  allowMultipleStates?: boolean;
}

const TOOTH_STATES = [
  { value: "sano", label: "Sano", color: "#ffffff" },
  { value: "caries", label: "Caries", color: "#ef4444" },
  { value: "obturacion", label: "Obturación", color: "#43eada" },
  { value: "ausente", label: "Ausente", color: "#94a3b8" },
  { value: "corona", label: "Corona", color: "#09919b" },
  { value: "endodoncia", label: "Endodoncia", color: "#f59e0b" },
  { value: "extraccion", label: "Extracción Indicada", color: "#dc2626" },
] as const;

// Numeración FDI correcta por cuadrante
const QUADRANTS = {
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28], // Cuadrante 2
  upperRight: [11, 12, 13, 14, 15, 16, 17, 18], // Cuadrante 1
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38], // Cuadrante 3
  lowerRight: [41, 42, 43, 44, 45, 46, 47, 48], // Cuadrante 4
};

function getToothColor(state: ToothState): string {
  return TOOTH_STATES.find(s => s.value === state)?.color || "#ffffff";
}

function getToothStateName(state: ToothState): string {
  return TOOTH_STATES.find(s => s.value === state)?.label || "Sano";
}

export function OdontogramAdvanced({
  value = [],
  onChange,
  className,
  disabled = false,
  allowMultipleStates = true,
}: OdontogramAdvancedProps) {
  const [selectedTeeth, setSelectedTeeth] = useState<ToothData[]>(value);
  const [editingTooth, setEditingTooth] = useState<number | null>(null);

  const getToothData = useCallback((toothNumber: number): ToothData => {
    return selectedTeeth.find(t => t.number === toothNumber) || {
      number: toothNumber,
      state: "sano",
    };
  }, [selectedTeeth]);

  const updateTooth = useCallback((toothNumber: number, updates: Partial<ToothData>) => {
    if (disabled) return;

    const newTeeth = [...selectedTeeth];
    const existingIndex = newTeeth.findIndex(t => t.number === toothNumber);

    if (existingIndex >= 0) {
      newTeeth[existingIndex] = { ...newTeeth[existingIndex], ...updates };
    } else {
      newTeeth.push({
        number: toothNumber,
        state: "sano",
        ...updates,
      });
    }

    setSelectedTeeth(newTeeth);
    onChange?.(newTeeth);
  }, [selectedTeeth, onChange, disabled]);

  const toggleTooth = useCallback((toothNumber: number) => {
    if (disabled) return;

    const tooth = getToothData(toothNumber);

    if (tooth.state === "sano") {
      // Marcar como seleccionado (corona por defecto)
      updateTooth(toothNumber, { state: "corona" });
    } else if (allowMultipleStates) {
      // Abrir popover para elegir estado
      setEditingTooth(toothNumber);
    } else {
      // Toggle simple: sano <-> corona
      updateTooth(toothNumber, { state: tooth.state === "corona" ? "sano" : "corona" });
    }
  }, [disabled, getToothData, updateTooth, allowMultipleStates]);

  // Renderizar un diente individual
  const renderTooth = (toothNumber: number, position: { x: number; y: number }) => {
    const tooth = getToothData(toothNumber);
    const isSelected = tooth.state !== "sano";
    const color = getToothColor(tooth.state);
    const borderColor = isSelected ? color : "#cbd5e1";

    const toothElement = (
      <g
        onClick={() => toggleTooth(toothNumber)}
        className={cn(
          "cursor-pointer transition-all",
          !disabled && "hover:opacity-80"
        )}
      >
        {/* Óvalo del diente */}
        <ellipse
          cx={position.x}
          cy={position.y}
          rx={28}
          ry={36}
          fill={isSelected ? color : "#ffffff"}
          stroke={borderColor}
          strokeWidth={isSelected ? 3 : 2}
          className="transition-all"
        />

        {/* Número del diente */}
        <text
          x={position.x}
          y={position.y}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn(
            "text-sm font-semibold select-none pointer-events-none",
            isSelected ? "fill-white" : "fill-slate-700"
          )}
        >
          {toothNumber}
        </text>
      </g>
    );

    return (
      <TooltipProvider key={toothNumber}>
        <Tooltip>
          <TooltipTrigger asChild>
            {toothElement}
          </TooltipTrigger>
          <TooltipContent className="bg-[#044c64] text-white border-none">
            <div className="text-xs">
              <p className="font-bold">Pieza {toothNumber}</p>
              <p className="text-white/80">{getToothStateName(tooth.state)}</p>
              {tooth.notes && (
                <p className="mt-1 text-[10px] text-white/60">{tooth.notes}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Calcular posiciones en forma de arco
  const getArcPositions = (teeth: number[], baseY: number, isUpper: boolean) => {
    const positions: { tooth: number; x: number; y: number }[] = [];
    const centerX = 400;
    const spacing = 70;
    const arcHeight = 40; // Curvatura del arco

    teeth.forEach((tooth, index) => {
      const offset = (index - 3.5) * spacing;
      const x = centerX + offset;

      // Calcular Y en forma de arco (parábola)
      const normalizedIndex = (index - 3.5) / 3.5;
      const arcOffset = Math.pow(normalizedIndex, 2) * arcHeight;
      const y = isUpper ? baseY + arcOffset : baseY - arcOffset;

      positions.push({ tooth, x, y });
    });

    return positions;
  };

  // Posiciones para cada cuadrante
  const upperLeftPositions = getArcPositions(QUADRANTS.upperLeft, 120, true);
  const upperRightPositions = getArcPositions(QUADRANTS.upperRight, 120, true);
  const lowerLeftPositions = getArcPositions(QUADRANTS.lowerLeft, 380, false);
  const lowerRightPositions = getArcPositions(QUADRANTS.lowerRight, 380, false);

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox="0 0 800 500"
        className="w-full h-auto"
        style={{ maxHeight: "500px" }}
      >
        {/* Labels de cuadrantes */}
        <text x="180" y="40" className="text-xs fill-slate-400 font-semibold">
          Cuadrante 2
        </text>
        <text x="580" y="40" className="text-xs fill-slate-400 font-semibold">
          Cuadrante 1
        </text>
        <text x="180" y="470" className="text-xs fill-slate-400 font-semibold">
          Cuadrante 3
        </text>
        <text x="580" y="470" className="text-xs fill-slate-400 font-semibold">
          Cuadrante 4
        </text>

        {/* Línea central punteada */}
        <line
          x1="400"
          y1="60"
          x2="400"
          y2="440"
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeDasharray="5,5"
          opacity="0.5"
        />

        {/* Arcada superior izquierda (Cuadrante 2) */}
        {upperLeftPositions.map(({ tooth, x, y }) =>
          renderTooth(tooth, { x, y })
        )}

        {/* Arcada superior derecha (Cuadrante 1) */}
        {upperRightPositions.map(({ tooth, x, y }) =>
          renderTooth(tooth, { x, y })
        )}

        {/* Arcada inferior izquierda (Cuadrante 3) */}
        {lowerLeftPositions.map(({ tooth, x, y }) =>
          renderTooth(tooth, { x, y })
        )}

        {/* Arcada inferior derecha (Cuadrante 4) */}
        {lowerRightPositions.map(({ tooth, x, y }) =>
          renderTooth(tooth, { x, y })
        )}
      </svg>

      {/* Leyenda de estados */}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        {TOOTH_STATES.filter(s => s.value !== "sano").map((state) => (
          <div key={state.value} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2"
              style={{
                backgroundColor: state.color,
                borderColor: state.color,
              }}
            />
            <span className="text-xs text-slate-600 font-medium">
              {state.label}
            </span>
          </div>
        ))}
      </div>

      {/* Popover para editar diente */}
      {editingTooth && allowMultipleStates && (
        <Popover
          open={!!editingTooth}
          onOpenChange={(open) => !open && setEditingTooth(null)}
        >
          <PopoverTrigger asChild>
            <div className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-[#044c64] mb-3">
                  Pieza {editingTooth}
                </h4>

                <Label className="text-xs font-semibold mb-2 block">
                  Estado del diente
                </Label>
                <RadioGroup
                  value={getToothData(editingTooth).state}
                  onValueChange={(value) =>
                    updateTooth(editingTooth, { state: value as ToothState })
                  }
                >
                  {TOOTH_STATES.map((state) => (
                    <div key={state.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={state.value} id={`${editingTooth}-${state.value}`} />
                      <Label
                        htmlFor={`${editingTooth}-${state.value}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{
                            backgroundColor: state.color,
                            borderColor: state.color,
                          }}
                        />
                        {state.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs font-semibold mb-2 block">
                  Notas adicionales
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Ej: Color A2, preparación específica..."
                  value={getToothData(editingTooth).notes || ""}
                  onChange={(e) =>
                    updateTooth(editingTooth, { notes: e.target.value })
                  }
                  className="text-sm min-h-[60px]"
                />
              </div>

              <Button
                onClick={() => setEditingTooth(null)}
                className="w-full bg-[#044c64] hover:bg-[#033a4e]"
                size="sm"
              >
                Guardar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
