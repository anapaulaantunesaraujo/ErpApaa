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

  // Garante os Dados Cadastrais da APAA com o CNPJ oficial
  const existingSettings = await prisma.companySettings.findFirst();
  const companyData = {
    razaoSocial: "50.756.275 ANA PAULA ANTUNES ARAUJO",
    nomeFantasia: "APAA CONSULTORIA",
    cnpj: "50.756.275/0001-28",
    porte: "ME",
    naturezaJuridica: "213-5 - Empresário (Individual)",
    cnaePrincipal: "85.99-6-99",
    cnaeDescricao: "Outras atividades de ensino não especificadas anteriormente",
    regimeTributario: "SIMPLES_NACIONAL",
    optanteSimples: true,
    aliquotaIssPadrao: 2.0,
    logradouro: "R VEREADOR TELEMACO DE OLIVEIRA",
    numero: "672",
    complemento: "",
    bairro: "CORDEIROS",
    cidade: "ITAJAI",
    uf: "SC",
    cep: "88.311-200",
    telefone: "(47) 9233-9005",
    email: "ANAPAULA.ANTUNESARAUJO@GMAIL.COM",
    emailFinanceiro: "ana.antunes@apaatreinamento.net.br",
  };

  if (existingSettings) {
    await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: companyData,
    });
    console.log("✔ Configurações da APAA CONSULTORIA atualizadas com sucesso (CNPJ: 50.756.275/0001-28).");
  } else {
    await prisma.companySettings.create({
      data: companyData,
    });
    console.log("✔ Configurações da APAA CONSULTORIA criadas com sucesso (CNPJ: 50.756.275/0001-28).");
  }

  // Garante o serviço padrão de treinamento/ensino vinculado ao CNAE 85.99-6-99
  const existingService = await prisma.companyService.findFirst({
    where: { cnae: "85.99-6-99" },
  });

  if (!existingService) {
    await prisma.companyService.create({
      data: {
        codigo: "SRV-TREIN-01",
        descricao: "Outras atividades de ensino não especificadas anteriormente (Treinamentos e Cursos)",
        cnae: "85.99-6-99",
        codigoTributacaoNacional: "08.02.01",
        itemLc116: "8.02",
        aliquotaIss: 2.0,
        retencaoIss: false,
        aliquotaPis: 0.0,
        aliquotaCofins: 0.0,
        aliquotaInss: 0.0,
        aliquotaIr: 0.0,
        aliquotaCsll: 0.0,
        ativo: true,
      },
    });
    console.log("✔ Serviço fiscal padrão com CNAE 85.99-6-99 cadastrado com sucesso.");
  }
}

main()
  .catch((e) => {
    console.error("Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

