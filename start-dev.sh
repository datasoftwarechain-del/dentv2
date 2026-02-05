#!/bin/bash

echo "🧹 Limpiando procesos anteriores..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

echo "🗑️  Limpiando caché de Next.js..."
rm -rf .next/dev/lock .next/cache 2>/dev/null

echo "🚀 Iniciando servidor de desarrollo..."
npm run dev
