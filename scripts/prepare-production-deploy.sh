#!/bin/bash

# Script para preparar el despliegue manual a producción
# Este script debe ejecutarse antes de subir las imágenes manualmente a AWS ECR

set -e

echo "🚀 Preparando despliegue a producción..."

# Verificar que estamos en el entorno correcto
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  ADVERTENCIA: NODE_ENV no está configurado como 'production'"
    echo "   Configurando NODE_ENV=production para este script..."
    export NODE_ENV=production
fi

# Verificar que tenemos acceso a Git
if [ ! -d ".git" ]; then
    echo "❌ Error: No se encontró un repositorio Git. Este script requiere Git para funcionar correctamente."
    exit 1
fi

# Mostrar información del commit actual
echo "📍 Commit actual:"
git log -1 --oneline
echo ""

# Actualizar la versión
echo "📦 Actualizando versión para producción..."
node scripts/update-version.js

if [ $? -eq 0 ]; then
    echo "✅ Versión actualizada exitosamente"
    
    # Mostrar la nueva versión
    NEW_VERSION=$(node -p "require('./package.json').version")
    echo "🎯 Nueva versión: $NEW_VERSION"
    
    # Mostrar información del build
    COMMIT_HASH=$(git rev-parse --short HEAD)
    echo "🔗 Commit hash: $COMMIT_HASH"
    
    # Opcional: mostrar el comando para verificar la versión en runtime
    echo ""
    echo "💡 Para verificar la versión después del despliegue:"
    echo "   curl https://your-api-domain.com/health"
    echo ""
else
    echo "❌ Error al actualizar la versión"
    exit 1
fi

echo "🎉 Preparación completa. Listo para construir y subir las imágenes manualmente."
echo ""
echo "📋 Siguientes pasos:"
echo "   1. Construir las imágenes Docker:"
echo "      docker build -t your-image:latest ."
echo "   2. Taggear para ECR:"
echo "      docker tag your-image:latest your-ecr-repo:latest"
echo "   3. Subir a ECR:"
echo "      docker push your-ecr-repo:latest"
