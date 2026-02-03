# DentV2 - Sistema de Gestión Dental

DentV2 es una plataforma moderna para la gestión de clínicas dentales, construida con tecnologías de alto rendimiento para ofrecer una experiencia fluida tanto a dentistas como a pacientes.

## 🚀 Tecnologías

- **Framework:** [Next.js 14+](https://nextjs.org/) (App Router)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
- **Base de Datos & Auth:** [Supabase](https://supabase.com/)
- **Iconos:** [Lucide React](https://lucide.dev/)

## 🛠️ Configuración Local

Sigue estos pasos para poner en marcha el proyecto en tu entorno local:

### 1. Clonar el repositorio e instalar dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (basado en `.env.example` si existe) y añade tus credenciales de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### 3. Iniciar el servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## 🎨 Guía de Estilo y Mejoras CSS

Para mantener una estética **premium** y profesional, te recomendamos seguir estas pautas:

### 1. Consistencia Visual
- Usa la paleta de colores definida en `tailwind.config.js`.
- Mantén espaciados uniformes usando las clases de `gap`, `p-{n}` y `m-{n}` de Tailwind.

### 2. Efectos Modernos (Glassmorphism)
Para lograr un look moderno en tarjetas y modales:
```html
<div class="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
  <!-- Contenido -->
</div>
```

### 3. Micro-interacciones
Añade transiciones suaves a todos los elementos interactivos:
- Usa `transition-all duration-300 ease-in-out`.
- Ejemplo en botones: `hover:scale-105 active:scale-95`.

### 4. Modo Oscuro y Gradientes
- Implementa gradientes sutiles para fondos: `bg-gradient-to-br from-slate-900 to-slate-800`.
- Usa colores "Slate" o "Zinc" para fondos oscuros para evitar el negro puro (#000), lo que da una sensación más refinada.

## 📦 Scripts Disponibles

- `npm run dev`: Inicia el modo desarrollo.
- `npm run build`: Crea la versión de producción.
- `npm run start`: Inicia la aplicación compilada.
- `npm run lint`: Ejecuta el linter para encontrar errores de código.
