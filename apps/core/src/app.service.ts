import { API_CORE_VERSION } from '@app/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {

  constructor(private readonly configService: ConfigService) {}

  private getPackageVersion(): string {
    try {
      // Leer el package.json de la raíz del monorepo
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      return packageJson.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getAutoIncrementedVersion(): string {
    try {
      const baseVersion = this.getPackageVersion();
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      
      // Solo auto-incrementar en entornos de staging/producción
      if (!['production', 'staging', 'sandbox'].includes(nodeEnv)) {
        return baseVersion;
      }

      // Obtener información del commit para generar un número único
      const commitInfo = this.getGitCommitInfo();
      let buildNumber = 0;
      let commitHash = '';

      if (commitInfo) {
        // Extraer hash del commit
        commitHash = commitInfo.replace('commit-', '').split(' ')[0];
        // Crear un número de build basado en el hash del commit
        // Convertir los primeros 4 caracteres del hash a número hexadecimal
        buildNumber = parseInt(commitHash.substring(0, 4), 16) % 1000;
      } else {
        // Fallback: usar variables de entorno si están disponibles
        const envBuildNumber = this.configService.get<string>('BUILD_NUMBER') || 
                              this.configService.get<string>('CI_BUILD_ID');
        if (envBuildNumber) {
          buildNumber = parseInt(envBuildNumber) % 1000;
        } else {
          // Último recurso: usar timestamp para generar número único
          buildNumber = Math.floor(Date.now() / 1000) % 1000;
        }
      }
      
      // Parsear la versión base (ej: "1.0.0")
      const versionParts = baseVersion.split('.');
      if (versionParts.length >= 3) {
        const major = parseInt(versionParts[0]) || 1;
        const minor = parseInt(versionParts[1]) || 0;
        const patch = parseInt(versionParts[2]) || 0;
        
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
      
      return baseVersion;
    } catch {
      return this.getPackageVersion();
    }
  }

  private getGitCommitInfo(): string {
    try {
      // Verificar si estamos en un repositorio git
      const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
      if (!isGitRepo) return null;

      // Obtener el hash del último commit
      const commitHash = execSync('git rev-parse HEAD', { 
        encoding: 'utf8', 
        cwd: process.cwd(),
        timeout: 5000 // 5 segundos de timeout
      }).trim();
      
      // Obtener información adicional del commit
      try {
        // Obtener la fecha del commit (formato corto)
        const commitDate = execSync(`git log -1 --format="%ci"`, { 
          encoding: 'utf8', 
          cwd: process.cwd(),
          timeout: 3000
        }).trim();
        
        // Extraer solo la fecha sin la hora
        const dateOnly = commitDate.split(' ')[0];
        
        return `commit-${commitHash.substring(0, 8)} (${dateOnly})`;
      } catch {
        // Si falla obtener la fecha, solo mostrar el hash
        return `commit-${commitHash.substring(0, 8)}`;
      }
    } catch {
      return null;
    }
  }

  private getAdditionalInfo(): string {
    // Buscar información alternativa si no hay branch disponible
    // NOTA: No incluir getGitCommitInfo() aquí para evitar duplicación
    const buildId = this.configService.get<string>('BUILD_ID') || 
                   this.configService.get<string>('BUILD_NUMBER') || 
                   this.configService.get<string>('CI_BUILD_ID');
    
    const commitSha = this.configService.get<string>('COMMIT_SHA') || 
                     this.configService.get<string>('GIT_COMMIT') || 
                     this.configService.get<string>('GIT_SHA');
    
    const deploymentId = this.configService.get<string>('DEPLOYMENT_ID') || 
                        this.configService.get<string>('RELEASE_ID');
    
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // Priorizar información más útil
    if (buildId) return `build-${buildId}`;
    if (commitSha) return `sha-${commitSha.substring(0, 8)}`;
    if (deploymentId) return `deploy-${deploymentId}`;
    if (nodeEnv && nodeEnv !== 'development') return `env-${nodeEnv}`;
    
    return null;
  }

  private getStaticVersion(): string {
    // Usar variable estática para versioning manual
    return API_CORE_VERSION;
  }

  getHealthCheck(): string {
    // Usar versión estática para formato sencillo: Version: 1.0.1
    const version = this.getStaticVersion();
    const versionInfo = version;
    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Health Check</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            background-color: #fff;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            margin-bottom: 60px;
          }
          h1 {
            color: #4caf50;
          }
          p {
            color: #333;
          }
          .status {
            font-size: 1.2rem;
            color: #4caf50;
          }
          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: rgba(255, 255, 255, 0.9);
            padding: 0.5rem;
            text-align: center;
            font-size: 0.8rem;
            color: #666;
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Health check</h1>
          <p class="status">The CORE service API is running smoothly.</p>
        </div>
        <div class="footer">
          Version: ${versionInfo}
        </div>
      </body>
      </html>
    `;
    return htmlResponse;
  }
}
