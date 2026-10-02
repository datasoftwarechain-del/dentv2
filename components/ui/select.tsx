import * as React from "react"
import { cn } from "@/lib/utils"
import { FIELD_SURFACE, FIELD_HEIGHT } from "./field-surface"
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
      const target = event.target as HTMLElement | null
      if (!target) return
      // Trigger area (the in-tree button + label).
      if (containerRef.current && containerRef.current.contains(target)) return
      // Portal-rendered SelectContent: lives on document.body, outside
      // containerRef, so it would otherwise be considered "outside" and
      // close the menu before the click on a SelectItem can fire.
      if (target.closest("[data-select-content]")) return
      setOpen(false)
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
        FIELD_SURFACE,
        FIELD_HEIGHT,
        "items-center justify-between text-left",
        // El panel abierto es la continuación del disparador: mismo
        // tratamiento que tiene enfocado, para que se lean como una pieza.
        "data-[state=open]:bg-background data-[state=open]:border-accent data-[state=open]:shadow-[0_0_0_3px_hsl(var(--accent)/.18)]",
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

  // El panel vive anclado a su disparador. Antes la posición se calculaba
  // UNA vez al abrir: bastaba scrollear con el select abierto para que el
  // panel se quedara flotando lejos del campo que lo abrió. Se recalcula
  // mientras esté abierto, escuchando scroll (en captura, para que valga
  // también dentro de contenedores con scroll propio) y resize.
  const open = context?.open
  const triggerRef = context?.triggerRef
  React.useEffect(() => {
    if (!open || !triggerRef?.current) return
    const ubicar = () => {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width })
    }
    ubicar()
    window.addEventListener("scroll", ubicar, true)
    window.addEventListener("resize", ubicar)
    return () => {
      window.removeEventListener("scroll", ubicar, true)
      window.removeEventListener("resize", ubicar)
    }
  }, [open, triggerRef])

  if (!context || !context.open) return null
  if (typeof window === 'undefined') return null

  const content = (
    <div
      ref={ref}
      data-select-content=""
      className={cn(
        // Capa flotante, no un rectángulo opaco: material translúcido con blur,
        // y una sombra proporcional al tamaño de la superficie.
        "fixed z-[9999] max-h-[300px] min-w-[8rem] overflow-auto rounded-xl border border-border/70 p-1",
        "bg-popover/85 backdrop-blur-xl backdrop-saturate-150 text-popover-foreground",
        "shadow-[0_16px_48px_-12px_rgba(18,45,60,.28),0_2px_8px_rgba(18,45,60,.10)]",
        "[@media(prefers-reduced-transparency:reduce)]:bg-popover [@media(prefers-reduced-transparency:reduce)]:backdrop-filter-none",
        // Crece DESDE el disparador (está justo arriba), no desde su centro:
        // la relación entre el campo y su panel queda explícita.
        "origin-top animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150 motion-reduce:animate-none",
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
          // 36 px de alto y esquinas que acompañan al panel: antes eran 30 px con
          // rounded-sm (2 px) dentro de un contenedor redondeado, y el resaltado
          // salía como una barra cian a sangre.
          "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-2.5 pr-8 text-left text-sm outline-none",
          "transition-colors duration-100 motion-reduce:transition-none",
          // El resaltado señala dónde estás, no grita. Antes era bg-accent a
          // opacidad plena, que tapaba el texto con su propio color.
          "hover:bg-accent/15 focus:bg-accent/20",
          "active:bg-accent/30",
          // Lo ELEGIDO es lo que merece énfasis, no lo que está bajo el mouse.
          isSelected && "font-medium text-accent-foreground bg-accent/10",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
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
          {isSelected && <Check className="h-4 w-4 text-accent" />}
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
  ({ className, placeholder, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    // Las etiquetas se registran cuando los <SelectItem> montan, o sea al
    // abrir el menú. Con un valor preseleccionado (p. ej. desde la URL) el
    // trigger mostraría el valor crudo: si el llamador pasa children, esos
    // mandan. Sin children, comportamiento de siempre.
    const registered =
      context?.value && context.getLabel(context.value)
        ? context.getLabel(context.value as string)
        : context?.value
    const label = children ?? registered
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
  <div
    ref={ref}
    // El separador va acá y no en la etiqueta: SelectLabel siempre es el
    // primer hijo de su grupo, así que :not(:first-child) nunca aplicaría.
    // Los grupos sí son hermanos entre sí.
    className={cn("[&:not(:first-child)]:mt-1 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60 [&:not(:first-child)]:pt-1", className)}
    {...props}
  />
))
SelectGroup.displayName = "SelectGroup"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Antes era text-sm font-semibold: el MISMO tamaño que los ítems, solo
      // que en negrita, así que "Restauraciones" parecía algo que se podía
      // elegir. Un encabezado de grupo tiene que leerse subordinado: más
      // chico, en versales y con tracking, como una etiqueta.
      "px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground",
      className,
    )}
    {...props}
  />
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
