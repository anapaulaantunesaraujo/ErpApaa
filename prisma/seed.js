const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "ana.antunes@apaatreinamento.net.br";
  const rawPassword = "123";
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Ana Paula Antunes",
      passwordHash: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: "Ana Paula Antunes",
      passwordHash: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("✔ Usuário administrador garantido com sucesso:");
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   Perfil: ${adminUser.role}`);
  console.log(`   ID: ${adminUser.id}`);
}

main()
  .catch((e) => {
    console.error("Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

