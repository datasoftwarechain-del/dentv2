# CurvedLoop Component

Un componente de texto curvo animado tipo marquesina con interacción de arrastre.

## Características

✨ **Animación suave** - Movimiento continuo y fluido
🎯 **Interactivo** - Arrastra con el mouse para controlar la dirección
🎨 **Personalizable** - Controla velocidad, curva, dirección y estilos
⚡ **Optimizado** - Usa SVG y requestAnimationFrame para mejor rendimiento

## Instalación

El componente ya está instalado en: `/components/ui/curved-loop.tsx`

## Uso Básico

```tsx
import CurvedLoop from '@/components/ui/curved-loop';

<CurvedLoop marqueeText="Welcome to DigitalDent ✦" />
```

## Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `marqueeText` | `string` | `''` | Texto a mostrar en el loop |
| `speed` | `number` | `2` | Velocidad de animación (1-5 recomendado) |
| `curveAmount` | `number` | `400` | Curvatura del texto (0-600) |
| `direction` | `'left' \| 'right'` | `'left'` | Dirección inicial de la animación |
| `interactive` | `boolean` | `true` | Permite arrastrar con el mouse |
| `className` | `string` | - | Clases CSS adicionales para el texto |

## Ejemplos

### 1. Uso Básico
```tsx
<CurvedLoop marqueeText="Welcome to React Bits ✦" />
```

### 2. Personalizado con Props
```tsx
<CurvedLoop
  marqueeText="Be ✦ Creative ✦ With ✦ React ✦ Bits ✦"
  speed={3}
  curveAmount={500}
  direction="right"
  interactive
  className="fill-primary"
/>
```

### 3. Velocidad Lenta
```tsx
<CurvedLoop
  marqueeText="Be ✦ Creative ✦ With ✦ React ✦ Bits ✦"
  speed={1.5}
  curveAmount={300}
  interactive
/>
```

### 4. Colores Personalizados
```tsx
<CurvedLoop
  marqueeText="Digital ✦ Dental ✦ Platform ✦"
  speed={2}
  curveAmount={400}
  className="fill-[#5227FF]"
/>
```

### 5. No Interactivo
```tsx
<CurvedLoop
  marqueeText="Automatizado ✦ Eficiente ✦ Seguro ✦"
  speed={2}
  interactive={false}
/>
```

## Integración en Landing Page

Ya está integrado en `/components/landing/curved-text-section.tsx` y agregado a la página principal.

Para personalizar el texto en la landing page, edita:
```tsx
// /components/landing/curved-text-section.tsx
<CurvedLoop
  marqueeText="Tu Texto Aquí ✦"
  speed={2}
  curveAmount={400}
  className="fill-primary"
/>
```

## Símbolos Decorativos

Puedes usar diferentes símbolos para separar el texto:
- `✦` - Estrella de 4 puntas
- `★` - Estrella rellena
- `•` - Punto
- `|` - Barra vertical
- `∙` - Punto medio
- `◆` - Diamante

## Estilos de Colores Disponibles

```tsx
// Colores del tema
className="fill-primary"      // Color primario
className="fill-accent"       // Color de acento
className="fill-white"        // Blanco
className="fill-foreground"   // Color de texto

// Colores personalizados
className="fill-[#5227FF]"    // Morado de marca
className="fill-[#00FFB3]"    // Verde neón
className="fill-[#FF006B]"    // Rosa
```

## Tips de Diseño

1. **Espaciado**: Agrega `✦` entre palabras para mejor legibilidad
2. **Velocidad**: Usa 1.5-2 para lectura, 3-4 para efecto dinámico
3. **Curva**: 300-400 para sutil, 500+ para dramático
4. **Interactividad**: Desactiva si solo quieres mostrar, activa para engagement

## Página de Demo

Visita `/test/curved-loop` para ver ejemplos en vivo con diferentes configuraciones.

## Compatibilidad

- ✅ Next.js 14+
- ✅ React 18+
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ Todos los navegadores modernos
