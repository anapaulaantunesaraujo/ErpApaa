import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const clientes = await prisma.customer.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json({ items: clientes });
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    return NextResponse.json({ error: "Erro ao buscar clientes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      nome,
      nomeFantasia,
      cpfCnpj,
      email,
      telefone,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      cep,
      codigoMunicipioIbge,
      inscricaoMunicipal,
    } = body;

    if (!nome || !cpfCnpj) {
      return NextResponse.json(
        { error: "Nome e CPF/CNPJ são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanCpfCnpj = String(cpfCnpj).replace(/\D/g, "");

    const cliente = await prisma.customer.upsert({
      where: { cpfCnpj: cleanCpfCnpj },
      update: {
        nome,
        nomeFantasia,
        email,
        telefone,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        cep,
        codigoMunicipioIbge,
        inscricaoMunicipal,
        ativo: true,
      },
      create: {
        nome,
        nomeFantasia,
        cpfCnpj: cleanCpfCnpj,
        email,
        telefone,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        cep,
        codigoMunicipioIbge,
        inscricaoMunicipal,
        ativo: true,
      },
    });

    return NextResponse.json({ success: true, item: cliente });
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    return NextResponse.json({ error: "Erro ao cadastrar cliente." }, { status: 500 });
  }
}

