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
  const FulfillmentRol = await prisma.rol.upsert({
    where: { name: "Fulfillment" },
    create: {
      name: "Fulfillment",
      createdAt: new Date(),
      createdBy: "seed",
    },
    update: {},
  });
  console.log({ AdminRol, SuperAdminRol, FulfillmentRol });

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
  console.log({ ClientPermission, CredentialPermission, UserPermission, RolPermission: RolPermissionPerm });

  // RolPermission: crear solo si no existe (unique roleId + permissionId)
  const rolPermissionData = [
    { roleId: FulfillmentRol.id, permissionId: ClientPermission.id },
    { roleId: AdminRol.id, permissionId: ClientPermission.id },
    { roleId: SuperAdminRol.id, permissionId: ClientPermission.id },
    { roleId: FulfillmentRol.id, permissionId: CredentialPermission.id },
    { roleId: AdminRol.id, permissionId: CredentialPermission.id },
    { roleId: SuperAdminRol.id, permissionId: CredentialPermission.id },
    { roleId: FulfillmentRol.id, permissionId: UserPermission.id },
    { roleId: AdminRol.id, permissionId: UserPermission.id },
    { roleId: SuperAdminRol.id, permissionId: UserPermission.id },
    { roleId: FulfillmentRol.id, permissionId: RolPermissionPerm.id },
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
    where: { email: "oborbolla@promologistics.com.mx" },
    create: {
      id: "0c7dd3a0-cc53-4f56-af40-dbdd4d94c2cf",
      email: "oborbolla@promologistics.com.mx",
      name: "Oscar Borbolla",
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
    where: { email: "admin@promologistics.com.mx" },
    create: {
      id: "0b45e028-7196-4e46-937d-3dfd999aff04",
      email: "admin@promologistics.com.mx",
      name: "Admin",
      password: "$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e",
      status: "ACTIVE",
      createdBy: "seed",
      roleId: SuperAdminRol.id,
    },
    update: { roleId: SuperAdminRol.id },
  });
  console.log({ admin });

  const user2 = await prisma.user.upsert({
    where: { email: "elugo@promologistics.com.mx" },
    create: {
      id: "a7bc7b1d-3080-4253-98a5-2426ae57f4a1",
      email: "elugo@promologistics.com.mx",
      name: "Eduardo Lugo",
      password: "$2b$10$LeSt3oySoG7N93rXafqWk.z4Td1A7CHKJNvF2sJVnZNwm8At9lM5e",
      status: "ACTIVE",
      createdBy: "seed",
      roleId: FulfillmentRol.id,
    },
    update: { roleId: FulfillmentRol.id },
  });
  console.log({ user2 });
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
