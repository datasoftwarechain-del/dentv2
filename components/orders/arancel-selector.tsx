"use client";

import { ARANCEL_OPTIONS, type ArancelType } from "@/lib/catalog-types";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ArancelSelectorProps {
  value: ArancelType | string;
  onChange: (value: ArancelType) => void;
  /** Filtra por categoría. Si se omite, muestra todas las opciones. */
  category?: "protesis_completa" | "protesis_parcial" | "otro";
  className?: string;
}

export function ArancelSelector({
  value,
  onChange,
  category,
  className,
}: ArancelSelectorProps) {
  const options = category
    ? ARANCEL_OPTIONS.filter((o) => o.category === category)
    : ARANCEL_OPTIONS;

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Tipo de arancel</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ArancelType)}
        className="space-y-2"
      >
        {options.map((option) => {
          const isSelected = value === option.type;
          const isPack = option.type === "protesis_completa_pack";
          return (
            <div
              key={option.type}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                isSelected
                  ? "border-primary/50 bg-primary/5"
                  : "hover:bg-muted/50"
              )}
              onClick={() => onChange(option.type)}
            >
              <RadioGroupItem
                value={option.type}
                id={option.type}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor={option.type}
                className="cursor-pointer flex-1 space-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{option.label}</span>
                  {isPack && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Recomendado
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
