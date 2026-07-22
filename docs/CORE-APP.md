# Documentación: API Core

## 1. Descripción general del proyecto

Este monorepo contiene la **API Core**, una aplicación backend construida con **NestJS** que actúa como servicio central de autenticación, gestión de usuarios y control de acceso por roles y permisos. La aplicación se conecta a una base de datos **MySQL** mediante **Prisma** y expone una API REST documentada con **Swagger**.

La app **core** es la única aplicación activa del monorepo (junto con las librerías compartidas) y concentra la lógica de negocio relacionada con usuarios, roles, permisos y autenticación.

---

## 2. Stack tecnológico

| Tecnología        | Uso                                      |
|-------------------|------------------------------------------|
| **NestJS 10**     | Framework backend (Node.js)              |
| **TypeScript**    | Lenguaje de programación                 |
| **Prisma**        | ORM y cliente de base de datos           |
| **MySQL**         | Base de datos                            |
| **JWT**           | Tokens de autenticación                  |
| **Passport**      | Estrategias de autenticación             |
| **Swagger**       | Documentación interactiva de la API      |
| **class-validator** / **class-transformer** | Validación y transformación de DTOs |
| **bcryptjs**      | Hash de contraseñas                      |

---

## 3. Propósito de la aplicación Core

La API Core se encarga de:

1. **Autenticación**: login, verificación de token, recuperación de contraseña, registro de cuenta y actualización de contraseña con token.
2. **Gestión de usuarios**: listado, creación, actualización de rol/estado y activación/desactivación de usuarios (solo para roles Admin/SuperAdmin).
3. **Gestión de roles y permisos**: asignar y quitar permisos a roles, listar roles y listar todos los permisos.
4. **Health check**: endpoint para verificar que el servicio está en ejecución y conocer la versión.

Todo lo anterior se apoya en los modelos de Prisma: **User**, **UserDetails**, **Rol**, **Permission** y **RolPermission**.

---

## 4. Arquitectura y módulos

La aplicación está organizada en módulos NestJS que se cargan en `AppModule`:

```
apps/core/src/
├── app.module.ts          # Módulo raíz
├── main.ts                # Bootstrap, Swagger, CORS, validación global
├── app.controller.ts      # Health check
├── app.service.ts         # Lógica del health check y versión
├── auth/                  # Login, JWT, recuperación de contraseña, registro
├── users/                 # CRUD de usuarios (protegido por rol)
├── role/                  # Roles y permisos (Rol, Permission, RolPermission)
├── repository/            # Repositorios (solo UserRepoService)
└── email/                 # Módulo de correo (templates, envío)
```

### 4.1 Módulos importados en `AppModule`

- **ConfigModule**: configuración global desde `.env`.
- **ScheduleModule**: tareas programadas (si se usan).
- **DatabaseModule**: provee **Prisma** (DatabaseService) como dependencia global.
- **AuthModule**: controladores y servicios de autenticación.
- **UsersModule**: gestión de usuarios (controlador, servicio, DTOs).
- **EmailModule**: envío de correos (bienvenida, recuperación, cambio de estado).
- **ServeStaticModule**: sirve archivos estáticos bajo `/static` (carpeta `public`).
- **RepositoryModule**: expone **UserRepoService** de forma global.
- **LogModule**: logging de la aplicación.

### 4.2 Controladores y servicios principales

- **AppController** + **AppService**: `GET /healthcheck` → HTML con estado y versión.
- **AuthController** + **AuthService**: login, verifyToken, validateEmail, updatePassword, recuperación de contraseña, registro, validación de contraseña.
- **UsersController** + **UsersService**: listar/crear/actualizar usuarios, actualizar rol, estado y autorización (activar/desactivar).
- **RoleController** + **RoleService**: asignar/eliminar permisos a roles, listar permisos por rol, listar roles y todos los permisos.

---

## 5. Modelo de datos (Prisma)

La API Core utiliza únicamente los siguientes modelos definidos en `prisma/schema.prisma`:

### 5.1 User

- Identificador único, email único, nombre, teléfono, empresa, contraseña (hash).
- Estado: `INACTIVE` por defecto; puede ser `ACTIVE`.
- Relación con **Rol** (`roleId`).
- Relación opcional 1:1 con **UserDetails**.
- Campos de auditoría: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`, `deactivatedAt`.

### 5.2 UserDetails

- Datos extendidos del usuario: teléfono, preferencias de notificaciones (`sendNotifications`, `receiveNotifications`).
- Relación 1:1 con **User** (`userId` único).

### 5.3 Rol

- Nombre único del rol (ej.: Admin, SuperAdmin, Fulfillment).
- Relación con muchos **User** y muchos **RolPermission** (permisos asignados al rol).

### 5.4 Permission

- Nombre del permiso (ej.: USERS, ROLES).
- Relación con muchos **RolPermission**.

### 5.5 RolPermission

- Tabla intermedia entre **Rol** y **Permission** (muchos a muchos).
- Incluye `roleId`, `permissionId` y constraint único `(roleId, permissionId)`.

### 5.6 Currency (enum)

- Valores: `MXN`, `USD` (disponible en el schema para uso futuro).

---

## 6. API: endpoints por área

### 6.1 Health

| Método | Ruta            | Descripción                          | Auth |
|--------|-----------------|--------------------------------------|------|
| GET    | `/healthcheck`  | Estado del servicio y versión (HTML) | No   |

### 6.2 Autenticación (`/auth`)

| Método | Ruta                          | Descripción                                      | Auth |
|--------|-------------------------------|--------------------------------------------------|------|
| POST   | `/auth/login`                 | Login (email, password, clientApp) → JWT + user | No   |
| POST   | `/auth/verifyToken`           | Verificar y decodificar token JWT                | No   |
| POST   | `/auth/validateEmail`         | Validar si un email existe                       | No   |
| PATCH  | `/auth/:token/updatePassword` | Actualizar contraseña usando token de registro  | No   |
| POST   | `/auth/sendRecoveryEmailAdmin` | Enviar correo de recuperación (admin)            | No   |
| POST   | `/auth/sendRecoveryEmail`     | Enviar correo de recuperación (cliente)          | No   |
| POST   | `/auth/registerAccount`       | Registro de cuenta (email, name, phone, company) | No   |
| POST   | `/auth/validatePassword`     | Validar fortaleza de contraseña                  | No   |

El login valida según `clientApp`: **ADMIN** (solo Admin/SuperAdmin) o **CLIENT** (solo Fulfillment).

### 6.3 Usuarios (`/users`)

Todos los endpoints de usuarios requieren **Bearer JWT** y rol **Admin** o **SuperAdmin**.

| Método | Ruta                      | Descripción                                      | Permiso |
|--------|---------------------------|--------------------------------------------------|---------|
| GET    | `/users`                  | Listar usuarios (filtros, paginación)            | —       |
| GET    | `/users/:id`              | Obtener un usuario por ID                        | —       |
| POST   | `/users`                  | Crear usuario (email, name, roleId, etc.)       | —       |
| PATCH  | `/users/:id/updateRole`   | Cambiar rol del usuario                          | USERS   |
| PATCH  | `/users/:id/updateStatus` | Actualizar estado (ACTIVE/INACTIVE)              | USERS   |
| PATCH  | `/users/:id/updateStatusBack` | Restaurar/alternar estado (activar/desactivar) | —       |
| PATCH  | `/users/:id/updateAuthorization` | Alternar autorización (activar/desactivar)   | —       |

### 6.4 Roles y permisos (`/role`)

Requieren **Bearer JWT** y rol **Admin** o **SuperAdmin**.

| Método | Ruta                           | Descripción                          | Permiso |
|--------|--------------------------------|--------------------------------------|---------|
| POST   | `/role/permission`             | Asignar permiso a un rol             | ROLES   |
| POST   | `/role/permission/delete`      | Quitar permiso de un rol             | ROLES   |
| GET    | `/role/permission/findByRole` | Listar permisos de un rol            | —       |
| GET    | `/role/findAll`                | Listar todos los roles               | —       |
| GET    | `/role/allPermissions`        | Listar todos los permisos            | —       |

---

## 7. Seguridad

- **JWT**: el login devuelve un `access_token` que debe enviarse en el header `Authorization: Bearer <token>` en las rutas protegidas.
- **Guards**:
  - **AuthGuard**: verifica que el token sea válido y que el usuario exista.
  - **RolesGuard**: verifica que el usuario tenga uno de los roles permitidos (Admin, SuperAdmin para usuarios y roles).
- **Decoradores**:
  - `@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)` para restringir por rol.
  - `@Can(PermissionsEnum.USERS)` o `@Can(PermissionsEnum.ROLES)` para restringir por permiso cuando aplica.
- **Validación**: `ValidationPipe` global con `whitelist` y `transform` para DTOs.
- **Contraseñas**: hash con **bcryptjs**; no se devuelve la contraseña en respuestas.

---

## 8. Documentación Swagger

Al ejecutar la aplicación, la documentación interactiva de la API está disponible en:

- **URL**: `http://localhost:3000/api`

Incluye todos los endpoints, esquemas de request/response y la opción de probar las rutas con **Bearer Auth**.

---

## 9. Configuración y ejecución

### 9.1 Variables de entorno

La aplicación usa un archivo `.env` en la raíz del proyecto (referenciado por `ConfigModule`). Algunas variables típicas:

- **DATABASE_URL**: cadena de conexión a MySQL para Prisma.
- **JWT_SECRET** / **JWT_EXPIRES_IN**: configuración del token.
- **FRONTEND_ADMIN_URL** / URLs de front para correos (registro, recuperación).
- Otras que usen los servicios de correo o la lógica de versión (NODE_ENV, BUILD_NUMBER, etc.).

### 9.2 Comandos principales

```bash
# Instalar dependencias
pnpm install

# Generar cliente de Prisma
npx prisma generate

# Crear y aplicar migración inicial (desarrollo; primera vez)
npx prisma migrate dev --name init

# O, si ya existen migraciones, solo aplicarlas
# npx prisma migrate deploy

# Seed (si existe)
pnpm run prisma db seed

# Desarrollo (watch)
pnpm run start:dev:core

# Build de producción
pnpm run build:core

# Ejecutar en producción
pnpm run start:prod
```

Por defecto la API escucha en el **puerto 3000**.

### 9.3 CORS

En `main.ts` se configuran orígenes permitidos (localhost en varios puertos y dominios de sandbox/producción de Promologistics y APIs externas como Mercado Libre y Next Cloud). Métodos permitidos: GET, POST, PATCH, PUT, DELETE; headers: Content-Type, Accept, Authorization; credentials habilitadas.

---

## 10. Resumen

La **app Core** es el backend central del monorepo y se encarga de:

- Autenticar usuarios (login, registro, recuperación de contraseña, validación de token y email).
- Gestionar usuarios (altas, listado, actualización de rol y estado) para administradores.
- Gestionar roles y permisos (asignación y listados).
- Exponer un health check con versión.

Todo ello sobre el modelo de datos **User**, **UserDetails**, **Rol**, **Permission** y **RolPermission** en MySQL con Prisma, protegido por JWT y control de roles/permisos, y documentado en Swagger en `/api`.
