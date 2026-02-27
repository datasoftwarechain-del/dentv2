#!/bin/bash

echo "🧹 Limpiando procesos anteriores..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

echo "🚀 Iniciando servidor de desarrollo (Turbopack)..."
pnpm dev
