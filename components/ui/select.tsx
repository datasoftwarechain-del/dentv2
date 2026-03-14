import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"
import { createPortal } from "react-dom"

type SelectContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  value: string | undefined
  setValue: (value: string) => void
  registerItem: (value: string, label: string) => void
  getLabel: (value: string) => string | undefined
  triggerRef: React.RefObject<HTMLButtonElement>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

export interface SelectProps {
  children: React.ReactNode
  value?: string
  defaultValue?: string
  required?: boolean
  onValueChange?: (value: string) => void
}

const Select = ({
  children,
  value,
  defaultValue,
  onValueChange,
}: SelectProps) => {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    defaultValue
  )
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isControlled = value !== undefined
  const finalValue = isControlled ? value : internalValue
  const itemsRef = React.useRef(new Map<string, string>())

  const registerItem = React.useCallback((itemValue: string, label: string) => {
    itemsRef.current.set(itemValue, label)
  }, [])

  const getLabel = React.useCallback((itemValue: string) => {
    return itemsRef.current.get(itemValue)
  }, [])

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue)
      }
      onValueChange?.(nextValue)
    },
    [isControlled, onValueChange]
  )

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <SelectContext.Provider
      value={{
        open,
        setOpen,
        value: finalValue,
        setValue,
        registerItem,
        getLabel,
        triggerRef,
      }}
    >
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) return null

  const mergedRef = React.useCallback(
    (node: HTMLButtonElement) => {
      (context.triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
    },
    [ref, context.triggerRef]
  )

  return (
    <button
      ref={mergedRef}
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={(event) => {
        props.onClick?.(event)
        context.setOpen(!context.open)
      }}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 })

  React.useEffect(() => {
    if (context?.open && context.triggerRef.current) {
      const rect = context.triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [context?.open, context?.triggerRef])

  if (!context || !context.open) return null
  if (typeof window === 'undefined') return null

  const content = (
    <div
      ref={ref}
      className={cn(
        "fixed z-[9999] min-w-[8rem] overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 max-h-[300px]",
        className
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
      {...props}
    />
  )

  return createPortal(content, document.body)
})
SelectContent.displayName = "SelectContent"

export interface SelectItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    const label =
      typeof children === "string" ? children : props["aria-label"] || value
    const isSelected = context?.value === value

    React.useEffect(() => {
      if (context && typeof label === "string") {
        context.registerItem(value, label)
      }
    }, [context, value, label])

    if (!context) return null

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground",
          className
        )}
        onClick={(event) => {
          props.onClick?.(event)
          context.setValue(value)
          context.setOpen(false)
        }}
        {...props}
      >
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4" />}
        </span>
        <span className="truncate">{children}</span>
      </button>
    )
  }
)
SelectItem.displayName = "SelectItem"

export interface SelectValueProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    const label =
      context?.value && context.getLabel(context.value)
        ? context.getLabel(context.value as string)
        : context?.value
    return (
      <span ref={ref} className={cn("pointer-events-none", className)} {...props}>
        {label || placeholder || "Select..."}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
))
SelectGroup.displayName = "SelectGroup"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
))
SelectLabel.displayName = "SelectLabel"

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
}
