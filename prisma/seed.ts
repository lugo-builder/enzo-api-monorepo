import { Resident } from "./../node_modules/.pnpm/@prisma+client@6.4.1_prisma@6.4.1_typescript@5.8.2__typescript@5.8.2/node_modules/.prisma/client/index.d";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Roles: upsert para poder ejecutar el seed varias veces sin error de unique
  const SuperAdminRol = await prisma.rol.upsert({
    where: { name: "SuperAdmin" },
    create: {
      name: "SuperAdmin",
      createdAt: new Date(),
      createdBy: "seed",
    },
    update: {},
  });
  const AdminRol = await prisma.rol.upsert({
    where: { name: "Admin" },
    create: {
      name: "Admin",
      createdAt: new Date(),
      createdBy: "seed",
    },
    update: {},
  });
  const ClientRol = await prisma.rol.upsert({
    where: { name: "Client" },
    create: {
      name: "Client",
      createdAt: new Date(),
      createdBy: "seed",
    },
    update: {},
  });
  console.log({ AdminRol, SuperAdminRol, ClientRol });

  // Permissions: Permission.name no es @unique en el schema, así que findFirst o create
  const getOrCreatePermission = async (name: string) => {
    const existing = await prisma.permission.findFirst({
      where: { name, deletedAt: null },
    });
    if (existing) return existing;
    return prisma.permission.create({
      data: { name, createdAt: new Date(), createdBy: "seed" },
    });
  };
  const ClientPermission = await getOrCreatePermission("clients");
  const CredentialPermission = await getOrCreatePermission("credentials");
  const UserPermission = await getOrCreatePermission("users");
  const RolPermissionPerm = await getOrCreatePermission("roles");
  console.log({
    ClientPermission,
    CredentialPermission,
    UserPermission,
    RolPermission: RolPermissionPerm,
  });

  // RolPermission: crear solo si no existe (unique roleId + permissionId)
  const rolPermissionData = [
    { roleId: ClientRol.id, permissionId: ClientPermission.id },
    { roleId: AdminRol.id, permissionId: ClientPermission.id },
    { roleId: SuperAdminRol.id, permissionId: ClientPermission.id },
    { roleId: ClientRol.id, permissionId: CredentialPermission.id },
    { roleId: AdminRol.id, permissionId: CredentialPermission.id },
    { roleId: SuperAdminRol.id, permissionId: CredentialPermission.id },
    { roleId: ClientRol.id, permissionId: UserPermission.id },
    { roleId: AdminRol.id, permissionId: UserPermission.id },
    { roleId: SuperAdminRol.id, permissionId: UserPermission.id },
    { roleId: ClientRol.id, permissionId: RolPermissionPerm.id },
    { roleId: AdminRol.id, permissionId: RolPermissionPerm.id },
    { roleId: SuperAdminRol.id, permissionId: RolPermissionPerm.id },
  ];
  for (const data of rolPermissionData) {
    await prisma.rolPermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: data.roleId,
          permissionId: data.permissionId,
        },
      },
      create: {
        roleId: data.roleId,
        permissionId: data.permissionId,
        createdBy: "seed",
      },
      update: {},
    });
  }

  // Users: upsert por email para poder re-ejecutar el seed
  const user = await prisma.user.upsert({
    where: { email: "j.eduardo.l.r+1@gmail.com" },
    create: {
      id: "0c7dd3a0-cc53-4f56-af40-dbdd4d94c2cf",
      email: "j.eduardo.l.r+1@gmail.com",
      name: "Roy Focker Admin",
      password: "$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e",
      createdBy: "seed",
      createdAt: new Date(),
      status: "ACTIVE",
      roleId: AdminRol.id,
    },
    update: { roleId: AdminRol.id },
  });
  console.log({ user });

  await prisma.userDetails.upsert({
    where: { userId: user.id },
    create: {
      phone: "5566778899",
      userId: user.id,
    },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: "j.eduardo.l.r@gmail.com" },
    create: {
      id: "0b45e028-7196-4e46-937d-3dfd999aff04",
      email: "j.eduardo.l.r@gmail.com",
      name: "Roy Focker SuperAdmin",
      password: "$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e",
      status: "ACTIVE",
      createdBy: "seed",
      roleId: SuperAdminRol.id,
    },
    update: { roleId: SuperAdminRol.id },
  });
  console.log({ admin });

  const user2 = await prisma.user.upsert({
    where: { email: "j.eduardo.l.r+2@gmail.com" },
    create: {
      id: "a7bc7b1d-3080-4253-98a5-2426ae57f4a1",
      email: "j.eduardo.l.r+2@gmail.com",
      name: "Roy Focker Client",
      password: "$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e",
      status: "ACTIVE",
      createdBy: "seed",
      roleId: ClientRol.id,
    },
    update: { roleId: ClientRol.id },
  });
  console.log({ user2 });

  // ---- Resident roles (prepared for future use) ----
  for (const name of [
    "ResidentAdministrator",
    "ResidentTreasurer",
    "ResidentReader",
    "Resident",
  ]) {
    await prisma.rol.upsert({
      where: { name },
      create: { name, createdAt: new Date(), createdBy: "seed" },
      update: {},
    });
  }

  // Migrate legacy HYDRA_* permission names → RESIDENT_*
  const legacyHydraPerms = await prisma.permission.findMany({
    where: { name: { startsWith: "HYDRA_" } },
  });
  for (const legacy of legacyHydraPerms) {
    const newName = legacy.name.replace(/^HYDRA_/, "RESIDENT_");
    const already = await prisma.permission.findFirst({
      where: { name: newName },
    });
    if (already) {
      const links = await prisma.rolPermission.findMany({
        where: { permissionId: legacy.id },
      });
      for (const link of links) {
        await prisma.rolPermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: link.roleId,
              permissionId: already.id,
            },
          },
          create: {
            roleId: link.roleId,
            permissionId: already.id,
            createdBy: "seed-migrate",
          },
          update: {},
        });
        await prisma.rolPermission.delete({
          where: {
            roleId_permissionId: {
              roleId: link.roleId,
              permissionId: legacy.id,
            },
          },
        });
      }
      await prisma.permission.delete({ where: { id: legacy.id } });
    } else {
      await prisma.permission.update({
        where: { id: legacy.id },
        data: { name: newName },
      });
    }
  }

  // Migrate legacy Hydra* role names → Resident*
  const roleRenames: Array<[string, string]> = [
    ["HydraAdministrator", "ResidentAdministrator"],
    ["HydraTreasurer", "ResidentTreasurer"],
    ["HydraReader", "ResidentReader"],
    ["HydraResident", "Resident"],
  ];
  for (const [from, to] of roleRenames) {
    const oldRole = await prisma.rol.findUnique({ where: { name: from } });
    if (!oldRole) continue;
    const newRole = await prisma.rol.findUnique({ where: { name: to } });
    if (newRole) {
      await prisma.user.updateMany({
        where: { roleId: oldRole.id },
        data: { roleId: newRole.id },
      });
      await prisma.rolPermission.deleteMany({ where: { roleId: oldRole.id } });
      await prisma.rol.delete({ where: { id: oldRole.id } });
    } else {
      await prisma.rol.update({
        where: { id: oldRole.id },
        data: { name: to },
      });
    }
  }

  // ---- Resident permissions ----
  const residentPermissions = [
    "RESIDENT_RESIDENTIAL_COMPLEXES",
    "RESIDENT_UNITS",
    "RESIDENT_RESIDENTS",
    "RESIDENT_WATER_METERS",
    "RESIDENT_WATER_READINGS",
    "RESIDENT_WATER_TARIFFS",
    "RESIDENT_BILLING_PERIODS",
    "RESIDENT_CHARGES",
    "RESIDENT_PAYMENTS",
    "RESIDENT_BANK_RECONCILIATION",
    "RESIDENT_ACCOUNT_STATEMENTS",
    "RESIDENT_REPORTS",
    "RESIDENT_IMPORTS",
    "RESIDENT_AUDIT",
    "RESIDENT_PERIOD_REOPEN",
  ];
  const ResidentPermRecords = [];
  for (const name of residentPermissions) {
    ResidentPermRecords.push(await getOrCreatePermission(name));
  }
  for (const role of [AdminRol, SuperAdminRol]) {
    for (const perm of ResidentPermRecords) {
      await prisma.rolPermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        create: {
          roleId: role.id,
          permissionId: perm.id,
          createdBy: "seed",
        },
        update: {},
      });
    }
  }

  // ---- Hydra residentialComplex + 90 units ----
  let hydraResidentialComplex = await prisma.residentialComplex.findFirst({
    where: { name: "Hydra", deletedAt: null },
  });
  if (!hydraResidentialComplex) {
    hydraResidentialComplex = await prisma.residentialComplex.create({
      data: {
        name: "Hydra",
        legalName: "Condominio Hydra",
        currency: "MXN",
        paymentDueDay: 10,
        totalUnits: 90,
        status: "ACTIVE",
        createdBy: "seed",
      },
    });
  } else {
    hydraResidentialComplex = await prisma.residentialComplex.update({
      where: { id: hydraResidentialComplex.id },
      data: {
        paymentDueDay: 10,
        totalUnits: 90,
        currency: "MXN",
        updatedBy: "seed",
      },
    });
  }
  console.log({
    hydraResidentialComplex: hydraResidentialComplex.name,
    id: hydraResidentialComplex.id,
  });

  for (let n = 1; n <= 90; n++) {
    const unitNumber = String(n);
    await prisma.residentialUnit.upsert({
      where: {
        residentialComplexId_unitNumber: {
          residentialComplexId: hydraResidentialComplex.id,
          unitNumber,
        },
      },
      create: {
        residentialComplexId: hydraResidentialComplex.id,
        unitNumber,
        displayName: `Casa ${n}`,
        status: "ACTIVE",
        createdBy: "seed",
      },
      update: {},
    });
  }

  const chargeTypes: Array<{
    code: string;
    name: string;
    category:
      | "ORDINARY_FEE"
      | "WATER"
      | "PENALTY"
      | "PARKING"
      | "EXTRAORDINARY_FEE"
      | "RESERVE_FUND"
      | "SURCHARGE"
      | "DISCOUNT"
      | "ADJUSTMENT"
      | "OTHER"
      | "OPENING_BALANCE";
    defaultAmount?: string;
    isRecurring?: boolean;
    isSystem?: boolean;
  }> = [
    {
      code: "ORDINARY_FEE",
      name: "Cuota ordinaria",
      category: "ORDINARY_FEE",
      // Referencia de catálogo; el monto operativo vive en RecurringChargeConfig
      defaultAmount: "165.00",
      isRecurring: true,
      isSystem: true,
    },
    {
      code: "WATER",
      name: "Consumo de agua",
      category: "WATER",
      isSystem: true,
    },
    {
      code: "PENALTY",
      name: "Sanción",
      category: "PENALTY",
      isSystem: true,
    },
    {
      code: "PARKING",
      name: "Cajón de estacionamiento adicional",
      category: "PARKING",
    },
    {
      code: "EXTRAORDINARY_FEE",
      name: "Cuota extraordinaria",
      category: "EXTRAORDINARY_FEE",
    },
    {
      code: "RESERVE_FUND",
      name: "Fondo de reserva",
      category: "RESERVE_FUND",
    },
    {
      code: "SURCHARGE",
      name: "Recargo",
      category: "SURCHARGE",
    },
    {
      code: "DISCOUNT",
      name: "Descuento",
      category: "DISCOUNT",
    },
    {
      code: "ADJUSTMENT",
      name: "Ajuste",
      category: "ADJUSTMENT",
      isSystem: true,
    },
    {
      code: "OTHER",
      name: "Otros",
      category: "OTHER",
    },
    // Sistema: migración de saldos (no listado de negocio, solo técnico)
    {
      code: "OPENING_BALANCE",
      name: "Saldo inicial / apertura",
      category: "OPENING_BALANCE",
      isSystem: true,
    },
  ];

  const chargeTypeByCode: Record<string, string> = {};
  for (const ct of chargeTypes) {
    const row = await prisma.chargeType.upsert({
      where: {
        residentialComplexId_code: {
          residentialComplexId: hydraResidentialComplex.id,
          code: ct.code,
        },
      },
      create: {
        residentialComplexId: hydraResidentialComplex.id,
        code: ct.code,
        name: ct.name,
        category: ct.category,
        defaultAmount: ct.defaultAmount,
        isRecurring: ct.isRecurring ?? false,
        isSystem: ct.isSystem ?? false,
        affectsBalance: true,
        status: "ACTIVE",
        createdBy: "seed",
      },
      update: {
        name: ct.name,
        defaultAmount: ct.defaultAmount,
        isRecurring: ct.isRecurring ?? false,
        isSystem: ct.isSystem ?? false,
      },
    });
    chargeTypeByCode[ct.code] = row.id;
  }

  // Cuota ordinaria versionada (configurable; no hardcodeada en servicios)
  const ordinaryTypeId = chargeTypeByCode["ORDINARY_FEE"];
  const existingOrdinaryConfig = await prisma.recurringChargeConfig.findFirst({
    where: {
      residentialComplexId: hydraResidentialComplex.id,
      chargeTypeId: ordinaryTypeId,
      status: "ACTIVE",
      effectiveTo: null,
    },
  });
  if (!existingOrdinaryConfig) {
    await prisma.recurringChargeConfig.create({
      data: {
        residentialComplexId: hydraResidentialComplex.id,
        chargeTypeId: ordinaryTypeId,
        amount: "165.00",
        currency: "MXN",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        effectiveTo: null,
        status: "ACTIVE",
        notes:
          "Cuota ordinaria inicial Hydra (seed). Cambiar vía nueva versión de RecurringChargeConfig.",
        createdBy: "seed",
      },
    });
  }

  // Tarifario estructural vacío de tramos productivos derivados de PDF.
  // Las cifras del PDF (p. ej. 803 / 25 m³) NO se cargan como datos productivos.
  // Para pruebas locales: SEED_HYDRA_DEV_FIXTURES=true
  let tariff = await prisma.waterTariff.findFirst({
    where: {
      residentialComplexId: hydraResidentialComplex.id,
      name: "Tarifa base Hydra",
    },
  });
  if (!tariff) {
    tariff = await prisma.waterTariff.create({
      data: {
        residentialComplexId: hydraResidentialComplex.id,
        name: "Tarifa base Hydra",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        baseCharge: "0",
        minimumConsumptionM3: "0",
        status: "ACTIVE",
        roundingMode: "HALF_UP",
        notes:
          "Cabecera inicial. Definir tramos reales vía API /water-tariffs (no importar PDF sin confirmación).",
        createdBy: "seed",
      },
    });
  }

  if (process.env.SEED_DEV_FIXTURES === "true") {
    const tierCount = await prisma.waterTariffTier.count({
      where: { tariffId: tariff.id },
    });
    if (tierCount === 0) {
      await prisma.waterTariffTier.create({
        data: {
          tariffId: tariff.id,
          m3: "0",
          amountPerM3: "0",
          fixedAmount: "68.00",
          calculationType: "LOOKUP_BY_M3",
          sortOrder: 0,
          createdBy: "seed-dev-fixture",
        },
      });
      console.log(
        "SEED_DEV_FIXTURES: fila lookup m3=0 → $68.00 (solo desarrollo)",
      );
    }
  }

  console.log({
    hydraResidentialComplex: hydraResidentialComplex.name,
    currency: hydraResidentialComplex.currency,
    paymentDueDay: hydraResidentialComplex.paymentDueDay,
    units: 90,
    chargeTypes: Object.keys(chargeTypeByCode).length,
    ordinaryFeeConfig: "165.00 MXN via RecurringChargeConfig",
    tariff: tariff.name,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
