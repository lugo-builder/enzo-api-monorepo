# Enzo API (Core)

Monorepo con la **API Core**: backend NestJS para autenticación, gestión de usuarios y control de roles/permisos. Base de datos MySQL con Prisma.

---

## Requisitos previos

- **Node.js** 18+ (recomendado 20.x)
- **pnpm** 10.x (gestor de paquetes del proyecto)
- **MySQL** 8.x (o compatible)
- **Git**

---

## Instalación rápida

```bash
# Clonar el repositorio (si aplica)
git clone <url-repositorio>
cd enzo-api-monorepo

# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y configuración

# (Opcional) Levantar MySQL local con Docker
docker compose up -d
# El .env ya incluye DATABASE_URL para esta instancia: mysql://root:local_password@localhost:3306/enzo_db

# Generar cliente de Prisma
npx prisma generate

# Crear y aplicar migración inicial (desarrollo; primera vez)
npx prisma migrate dev --name init

# O, si ya existen migraciones, solo aplicarlas
# npx prisma migrate deploy

# (Opcional) Ejecutar seed inicial
pnpm exec prisma db seed

# Arrancar en modo desarrollo
pnpm run start:dev:core
```

La API quedará disponible en **http://localhost:3000**. Documentación Swagger en **http://localhost:3000/api**.

---

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto. Variables necesarias:

| Variable                | Descripción                                                                                               | Ejemplo                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`          | Cadena de conexión MySQL (Prisma). Con Docker local: `mysql://root:local_password@localhost:3306/enzo_db` | `mysql://user:pass@localhost:3306/dbname`       |
| `JWT_SECRET`            | Secreto para firmar tokens JWT                                                                            | string seguro                                   |
| `JWT_EXPIRES_IN`        | Expiración del token                                                                                      | `12h`                                           |
| `TOKEN_EXPIRATION_TIME` | Tiempo del token de registro                                                                              | `1h`                                            |
| `DEFAULT_ROL`           | Nombre del rol por defecto                                                                                | `Default`                                       |
| `DEFAULT_ADMIN_ROL`     | Nombre del rol admin                                                                                      | `Admin`                                         |
| `DEFAULT_PASSWORD`      | Contraseña por defecto para nuevos usuarios                                                               | (string)                                        |
| `NODE_ENV`              | Entorno                                                                                                   | `local`, `development`, `sandbox`, `production` |
| `FRONTEND_ADMIN_URL`    | URL del front admin (emails)                                                                              | `http://localhost:5173`                         |

Para despliegue o más opciones, revisar el uso en el código y en [docs/CORE-APP.md](docs/CORE-APP.md).

---

## Estructura del proyecto

```
enzo-api-monorepo/
├── apps/
│   └── core/                 # Aplicación API Core (única app activa)
│       └── src/
│           ├── main.ts       # Bootstrap, Swagger, CORS
│           ├── app.module.ts
│           ├── auth/         # Login, JWT, recuperación de contraseña
│           ├── users/        # CRUD usuarios
│           ├── role/         # Roles y permisos
│           ├── repository/   # UserRepoService
│           └── email/
├── libs/
│   ├── common/               # Utilidades, DTOs, enums, servicios compartidos
│   ├── database/             # Prisma (DatabaseService)
│   └── log/                  # Logging
├── prisma/
│   ├── schema.prisma         # Modelos: User, UserDetails, Rol, Permission, RolPermission
│   ├── seed.ts               # Datos iniciales
│   └── migrations/
├── docs/
│   └── CORE-APP.md           # Documentación detallada de la API Core
├── package.json
├── nest-cli.json             # Monorepo: proyecto "core" + libs
└── tsconfig.json
```

**Alias de importación:** `@app/common`, `@app/database`, `@app/log` (ver `package.json` → `jest.moduleNameMapper` y `tsconfig`).

---

## Scripts útiles

| Comando                       | Descripción                                      |
| ----------------------------- | ------------------------------------------------ |
| `pnpm run start:dev:core`     | Desarrollo con hot-reload (Core)                 |
| `pnpm run build:core`         | Build de producción (Core)                       |
| `pnpm run start:prod`         | Ejecutar build: `node dist/apps/core/main`       |
| `pnpm run start:debug:core`   | Desarrollo con depurador                         |
| `pnpm run build:core:prod`    | Actualizar versión + build Core                  |
| `pnpm run build:core:sbx`     | Build para sandbox                               |
| `pnpm run lint`               | ESLint en apps y libs                            |
| `pnpm run format`             | Prettier en `apps/**` y `libs/**`                |
| `pnpm run test`               | Tests unitarios (Jest)                           |
| `pnpm run test:watch`         | Tests en modo watch                              |
| `pnpm run test:cov`           | Tests con cobertura                              |
| `pnpm run test:e2e`           | Tests e2e (config en apps/core)                  |
| `pnpm run copy:all-templates` | Copiar plantillas de email a `dist` (post-build) |

### Prisma

```bash
npx prisma generate              # Regenerar cliente tras cambiar schema
npx prisma migrate dev --name init   # Crear y aplicar migración inicial (desarrollo; primera vez)
npx prisma migrate dev           # Crear/aplicar migraciones (desarrollo)
npx prisma migrate deploy        # Aplicar migraciones (producción)
pnpm exec prisma db seed         # Ejecutar seed
npx prisma studio                # UI para ver/editar datos
```

---

## Base de datos

- **ORM:** Prisma con MySQL.
- **MySQL local con Docker:** en la raíz hay un `docker-compose.yml` que levanta MySQL 8. Ejecutar `docker compose up -d` y usar en `.env` la variable `DATABASE_URL="mysql://root:local_password@localhost:3306/enzo_db"`.
- **Modelos principales:** `User`, `UserDetails`, `Rol`, `Permission`, `RolPermission` (y enum `Currency`).
- Las migraciones están en `prisma/migrations/`. Tras clonar o cambiar el schema:
  1. `npx prisma generate`
  2. Primera vez en desarrollo: `npx prisma migrate dev --name init`; si ya hay migraciones: `npx prisma migrate deploy` (o `migrate dev` para crear nuevas).
  3. Opcional: `pnpm exec prisma db seed`

---

## API y documentación

- **Base URL (local):** `http://localhost:3000`
- **Swagger (OpenAPI):** `http://localhost:3000/api` — documentación interactiva y pruebas con Bearer JWT.
- **Health check:** `GET /healthcheck` — devuelve HTML con estado y versión.

Descripción de módulos, endpoints, modelo de datos y seguridad: **[docs/CORE-APP.md](docs/CORE-APP.md)**.

---

## Testing

- Tests unitarios: `pnpm run test` (Jest, raíces en `apps/` y `libs/`).
- E2E: `pnpm run test:e2e` (configuración en `apps/core/test/jest-e2e.json`).
- Alias de módulos en tests: mismos que en código (`@app/common`, `@app/database`, `@app/log`).

---

## Convenciones para desarrolladores

1. **Gestor de paquetes:** usar **pnpm** (no npm/yarn); el proyecto declara `packageManager` en `package.json`.
2. **Rutas y DTOs:** validar con `class-validator`; usar `ValidationPipe` (ya global en `main.ts`).
3. **Rutas protegidas:** usar `AuthGuard` + `RolesGuard` y decoradores `@Roles()`, `@Can()` según permisos.
4. **Base de datos:** acceso vía `DatabaseService` (Prisma) inyectado; no crear nuevos repos sin alinearlos con el schema actual.
5. **Código compartido:** colocar en `libs/common` o en la lib correspondiente y importar vía alias `@app/*`.
6. **Formato:** `pnpm run format` antes de commit; el lint se puede automatizar en CI con `pnpm run lint`.

---

## Documentación adicional

- **[docs/CORE-APP.md](docs/CORE-APP.md)** — Explicación detallada de la API Core: arquitectura, endpoints, modelo de datos, seguridad y configuración.

---

docker run -d \
--name mysql-enzo \
-p 3306:3306 \
-e MYSQL_ROOT_PASSWORD=root777 \
-e MYSQL_DATABASE=development \
mysql:8.0

---

## Licencia

UNLICENSED (proyecto privado).
