import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
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
          bairro: "CORDEIROS",
          cidade: "ITAJAI",
          uf: "SC",
          cep: "88.311-200",
          telefone: "(47) 9233-9005",
          email: "ANAPAULA.ANTUNESARAUJO@GMAIL.COM",
          emailFinanceiro: "ana.antunes@apaatreinamento.net.br",
        },
      });
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json({ error: "Erro ao buscar configurações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      razaoSocial,
      nomeFantasia,
      cnpj,
      inscricaoMunicipal,
      porte,
      naturezaJuridica,
      cnaePrincipal,
      cnaeDescricao,
      regimeTributario,
      optanteSimples,
      aliquotaIssPadrao,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      cep,
      telefone,
      email,
      emailFinanceiro,
      emailHost,
      emailPort,
      emailUser,
      emailPass,
      emailFolder,
      geminiApiKey,
      agenciaSicredi,
      contaSicredi,
    } = body;

    let settings = await prisma.companySettings.findFirst();

    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          razaoSocial,
          nomeFantasia,
          cnpj,
          inscricaoMunicipal,
          porte,
          naturezaJuridica,
          cnaePrincipal,
          cnaeDescricao,
          regimeTributario,
          optanteSimples: Boolean(optanteSimples),
          aliquotaIssPadrao: Number(aliquotaIssPadrao) || 2.0,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
          cep,
          telefone,
          email,
          emailFinanceiro,
          emailHost,
          emailPort: emailPort ? Number(emailPort) : null,
          emailUser,
          emailPass,
          emailFolder: emailFolder || "INBOX",
          geminiApiKey,
          agenciaSicredi,
          contaSicredi,
        },
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          razaoSocial: razaoSocial || "50.756.275 ANA PAULA ANTUNES ARAUJO",
          nomeFantasia: nomeFantasia || "APAA CONSULTORIA",
          cnpj: cnpj || "50.756.275/0001-28",
          inscricaoMunicipal,
          porte: porte || "ME",
          naturezaJuridica: naturezaJuridica || "213-5 - Empresário (Individual)",
          cnaePrincipal: cnaePrincipal || "85.99-6-99",
          cnaeDescricao: cnaeDescricao || "Outras atividades de ensino não especificadas anteriormente",
          regimeTributario: regimeTributario || "SIMPLES_NACIONAL",
          optanteSimples: Boolean(optanteSimples),
          aliquotaIssPadrao: Number(aliquotaIssPadrao) || 2.0,
          logradouro: logradouro || "R VEREADOR TELEMACO DE OLIVEIRA",
          numero: numero || "672",
          complemento,
          bairro: bairro || "CORDEIROS",
          cidade: cidade || "ITAJAI",
          uf: uf || "SC",
          cep: cep || "88.311-200",
          telefone: telefone || "(47) 9233-9005",
          email: email || "ANAPAULA.ANTUNESARAUJO@GMAIL.COM",
          emailFinanceiro: emailFinanceiro || "ana.antunes@apaatreinamento.net.br",
          emailHost,
          emailPort: emailPort ? Number(emailPort) : null,
          emailUser,
          emailPass,
          emailFolder: emailFolder || "INBOX",
          geminiApiKey,
          agenciaSicredi,
          contaSicredi,
        },
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    return NextResponse.json({ error: "Erro ao salvar configurações." }, { status: 500 });
  }
}

