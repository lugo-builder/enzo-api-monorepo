#!/usr/bin/env node

/**
 * Script para actualizar automáticamente la versión en package.json
 * basándose en el entorno y el commit actual
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getBuildNumber(commitHash) {
  if (!commitHash) return 0;
  // Convertir los primeros 4 caracteres del hash a número hexadecimal
  return parseInt(commitHash.substring(0, 4), 16) % 1000;
}

function incrementVersion(version, buildNumber, nodeEnv, commitHash) {
  const parts = version.split('.');
  if (parts.length >= 3) {
    const major = parseInt(parts[0]) || 1;
    const minor = parseInt(parts[1]) || 0;
    const patch = parseInt(parts[2]) || 0;
    
    // En producción, usar un incremento más conservador para despliegues manuales
    if (nodeEnv === 'production') {
      // Para producción, incrementar basándose en un seed más estable
      const seed = commitHash ? parseInt(commitHash.substring(4, 8), 16) : buildNumber;
      const newPatch = patch + (seed % 100) + 1; // Entre 1-100 incrementos
      return `${major}.${minor}.${newPatch}`;
    } else {
      // Para staging/sandbox, usar el algoritmo original
      const newPatch = patch + buildNumber;
      return `${major}.${minor}.${newPatch}`;
    }
  }
  return version;
}

function updatePackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    // Leer el package.json actual
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    const nodeEnv = process.env.NODE_ENV;
    
    // Solo auto-incrementar en entornos de staging/producción
    if (!['production', 'staging', 'sandbox'].includes(nodeEnv)) {
      console.log(`Entorno ${nodeEnv} - No se incrementará la versión`);
      return;
    }
    
    // Obtener información del commit
    const commitHash = getCommitHash();
    let buildNumber = 0;
    
    if (commitHash) {
      buildNumber = getBuildNumber(commitHash);
    } else {
      // Fallback para despliegues manuales: usar variables de entorno o timestamp
      const envBuildNumber = process.env.BUILD_NUMBER || process.env.CI_BUILD_ID;
      if (envBuildNumber) {
        buildNumber = parseInt(envBuildNumber) % 1000;
      } else {
        // Último recurso: usar timestamp
        buildNumber = Math.floor(Date.now() / 1000) % 1000;
        console.log('No se pudo obtener hash del commit, usando timestamp como fallback');
      }
    }
    
    const newVersion = incrementVersion(packageJson.version, buildNumber, nodeEnv, commitHash);
    
    if (newVersion !== packageJson.version) {
      packageJson.version = newVersion;
      
      // Escribir el package.json actualizado
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      
      console.log(`Versión actualizada: ${packageJson.version} -> ${newVersion}`);
      if (commitHash) {
        console.log(`Commit: ${commitHash.substring(0, 8)}`);
      }
      console.log(`Build number: ${buildNumber}`);
      console.log(`Entorno: ${nodeEnv}`);
    } else {
      console.log(`Versión no cambió: ${packageJson.version}`);
    }
    
  } catch (error) {
    console.error('Error actualizando package.json:', error.message);
    process.exit(1);
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  updatePackageJson();
}

module.exports = { updatePackageJson, incrementVersion, getBuildNumber };
