"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados.",
  className,
  disabled,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((opt) => opt.value === value);

  // Sort + filter manually so we fully control order
  const sortedFiltered = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    // Base list always sorted alphabetically
    const sorted = [...options].sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" })
    );

    if (!q) return sorted;

    const startsWith: ComboboxOption[] = [];
    const wordStartsWith: ComboboxOption[] = [];
    const contains: ComboboxOption[] = [];

    for (const opt of sorted) {
      const label = opt.label.toLowerCase();
      if (label.startsWith(q)) {
        startsWith.push(opt);
      } else if (label.split(/\s+/).some((w) => w.startsWith(q))) {
        wordStartsWith.push(opt);
      } else if (label.includes(q)) {
        contains.push(opt);
      }
    }

    // Already sorted alphabetically within each group
    return [...startsWith, ...wordStartsWith, ...contains];
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal bg-background border-border/60 hover:bg-muted/30 focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 shadow-lg border border-border/60"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9 text-sm"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-56 overflow-y-auto">
            {sortedFiltered.length === 0 && (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </CommandEmpty>
            )}
            <CommandGroup>
              {sortedFiltered.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onValueChange(opt.value === value ? "" : opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-sm cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-primary shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
