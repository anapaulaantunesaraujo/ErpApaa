import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secretKey = searchParams.get("key");

  // Proteção básica para permitir executar a sincronização inicial em produção
  if (secretKey !== "apaa2026") {
    return NextResponse.json(
      { error: "Chave de autorização inválida. Use ?key=apaa2026" },
      { status: 403 }
    );
  }

  const logs: string[] = [];

  try {
    logs.push("Testando conexão com o banco de dados...");
    await prisma.$connect();
    logs.push("✔ Conexão com o PostgreSQL estabelecida com sucesso!");

    // 1. Garante o Usuário Administrador
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
    logs.push(`✔ Administrador garantido: ${adminUser.email} (Perfil: ${adminUser.role})`);

    // 2. Garante os Dados Cadastrais Oficiais da APAA
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
      emailFinanceiro: "apaaerp@gmail.com",
      emailHost: "imap.gmail.com",
      emailPort: 993,
      emailUser: "apaaerp@gmail.com",
      emailPass: "fgut uliz evis bqdm",
      emailFolder: "APAA_FINANCEIRO",
    };

    if (existingSettings) {
      await prisma.companySettings.update({
        where: { id: existingSettings.id },
        data: companyData,
      });
      logs.push("✔ Configurações da APAA CONSULTORIA atualizadas.");
    } else {
      await prisma.companySettings.create({
        data: companyData,
      });
      logs.push("✔ Configurações da APAA CONSULTORIA criadas.");
    }

    // 3. Garante Serviço Fiscal Padrão
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
          ativo: true,
        },
      });
      logs.push("✔ Serviço fiscal padrão (CNAE 85.99-6-99) criado.");
    }

    // 4. Garante Conta Sicredi Principal
    let bankAccount = await prisma.bankAccount.findFirst({
      where: { banco: "Sicredi" },
    });
    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.create({
        data: {
          banco: "Sicredi",
          tipo: "CORRENTE",
          agencia: "0101",
          conta: "12345-6",
          descricao: "Sicredi Conta Principal APAA",
          saldoInicial: 6359.07,
          saldoAtual: 6359.07,
          cor: "#0B3D91",
          ativo: true,
        },
      });
      logs.push("✔ Conta Bancária Sicredi criada.");
    }

    // 5. Garante Cartão de Crédito
    const existingCard = await prisma.creditCard.findFirst();
    if (!existingCard) {
      await prisma.creditCard.create({
        data: {
          nome: "Sicredi Corporativo",
          bandeira: "MASTERCARD",
          ultimosDigitos: "4321",
          limite: 15000.0,
          diaFechamento: 5,
          diaVencimento: 15,
          bankAccountId: bankAccount.id,
          ativo: true,
        },
      });
      logs.push("✔ Cartão de Crédito Sicredi Corporativo criado.");
    }

    return NextResponse.json({
      success: true,
      message: "Banco de dados e usuário administrador sincronizados com sucesso!",
      logs,
    });
  } catch (error: any) {
    console.error("Erro na inicialização do banco:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        detalhes: "Verifique se a DATABASE_URL no Cloud Run está correta e se a instância do Cloud SQL está acessível.",
        logs,
      },
      { status: 500 }
    );
  }
}
