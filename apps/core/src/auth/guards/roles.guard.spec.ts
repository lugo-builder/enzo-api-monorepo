import { ExecutionContext } from '@nestjs/common';

import { config } from '@app/common/consts/base.config';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: any;
  let prisma: any;

  const createContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
      get: jest.fn(),
    };
    prisma = {
      user: { findUnique: jest.fn() },
    };
    guard = new RolesGuard(reflector, prisma);
  });

  it('sin user en el request → false', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(undefined);

    const result = await guard.canActivate(createContext(undefined));

    expect(result).toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rol Admin (config.defaultAdmin) hace bypass y siempre permite acceso', async () => {
    reflector.getAllAndOverride.mockReturnValue(['SomeOtherRole']);
    reflector.get.mockReturnValue(['RESIDENT_AUDIT']);
    const user = { userId: 'u1', rol: { name: config.defaultAdmin } };

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(true);
    // El bypass de Admin ocurre antes de consultar permisos en BD
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rol no incluido en @Roles requeridos → false', async () => {
    reflector.getAllAndOverride.mockReturnValue(['SuperAdmin']);
    reflector.get.mockReturnValue(undefined);
    const user = { userId: 'u1', rol: { name: 'Fulfillment' } };

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(false);
  });

  it('rol sin el permiso requerido por @Can → false', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(['RESIDENT_AUDIT']);
    const user = { userId: 'u1', rol: { name: 'Fulfillment' } };
    prisma.user.findUnique.mockResolvedValue({
      role: { RolPermission: [{ permission: { name: 'RESIDENT_WATER_READINGS' } }] },
    });

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(false);
  });

  it('usuario con el permiso requerido por @Can → true', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(['RESIDENT_AUDIT']);
    const user = { userId: 'u1', rol: { name: 'Fulfillment' } };
    prisma.user.findUnique.mockResolvedValue({
      role: { RolPermission: [{ permission: { name: 'RESIDENT_AUDIT' } }] },
    });

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(true);
  });

  it('sin permisos declarados (@Can ausente) → true una vez pasado el check de roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(undefined);
    const user = { userId: 'u1', rol: { name: 'Fulfillment' } };

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('RESIDENT_PERIOD_REOPEN: usuario sin ese permiso específico no puede reabrir periodos', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(['RESIDENT_PERIOD_REOPEN']);
    const user = { userId: 'u1', rol: { name: 'Fulfillment' } };
    prisma.user.findUnique.mockResolvedValue({
      role: { RolPermission: [{ permission: { name: 'RESIDENT_WATER_READINGS' } }] },
    });

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(false);
  });

  it('RESIDENT_AUDIT: usuario con permiso de auditoría explícito puede acceder', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(['RESIDENT_AUDIT']);
    const user = { userId: 'u1', rol: { name: 'Fulfillment' } };
    prisma.user.findUnique.mockResolvedValue({
      role: {
        RolPermission: [
          { permission: { name: 'RESIDENT_PERIOD_REOPEN' } },
          { permission: { name: 'RESIDENT_AUDIT' } },
        ],
      },
    });

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(true);
  });

  it('regresa false cuando el usuario no existe en la base de datos', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    reflector.get.mockReturnValue(['RESIDENT_AUDIT']);
    const user = { userId: 'missing', rol: { name: 'Fulfillment' } };
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await guard.canActivate(createContext(user));

    expect(result).toBe(false);
  });
});
