import * as React from "react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string | undefined;
  setValue: (value: string) => void;
  registerItem: (value: string, label: string) => void;
  getLabel: (value: string) => string | undefined;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

export interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
}

const Select = ({
  children,
  value,
  defaultValue,
  onValueChange,
}: SelectProps) => {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    defaultValue
  );
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;
  const finalValue = isControlled ? value : internalValue;
  const itemsRef = React.useRef(new Map<string, string>());

  const registerItem = React.useCallback((itemValue: string, label: string) => {
    itemsRef.current.set(itemValue, label);
  }, []);

  const getLabel = React.useCallback((itemValue: string) => {
    return itemsRef.current.get(itemValue);
  }, []);

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange]
  );

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        open,
        setOpen,
        value: finalValue,
        setValue,
        registerItem,
        getLabel,
      }}
    >
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  if (!context) return null;
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
        className
      )}
      onClick={(event) => {
        props.onClick?.(event);
        context.setOpen(!context.open);
      }}
      {...props}
    />
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  if (!context || !context.open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "absolute left-0 top-full z-50 mt-2 w-full rounded-md border border-border bg-background shadow-lg",
        className
      )}
      {...props}
    />
  );
});
SelectContent.displayName = "SelectContent";

export interface SelectItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const label =
      typeof children === "string" ? children : props["aria-label"] || value;

    React.useEffect(() => {
      if (context && typeof label === "string") {
        context.registerItem(value, label);
      }
    }, [context, value, label]);

    if (!context) return null;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted",
          className
        )}
        onClick={(event) => {
          props.onClick?.(event);
          context.setValue(value);
          context.setOpen(false);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
SelectItem.displayName = "SelectItem";

export interface SelectValueProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const label =
      context?.value && context.getLabel(context.value)
        ? context.getLabel(context.value as string)
        : context?.value;
    return (
      <span ref={ref} className={className} {...props}>
        {label || placeholder || "Seleccionar"}
      </span>
    );
  }
);
SelectValue.displayName = "SelectValue";

const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
));
SelectGroup.displayName = "SelectGroup";

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
));
SelectLabel.displayName = "SelectLabel";

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
};
