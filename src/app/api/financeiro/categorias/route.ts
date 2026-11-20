import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DEFAULT_CATEGORIAS = [
  { nome: "Obrigações com o Governo / Impostos", cor: "#DC2626", icone: "Landmark", descricao: "DAS, Simples Nacional, INSS, Taxas e Tributos Municipais e Federais" },
  { nome: "Licenças & Aplicativos / Software", cor: "#0284C7", icone: "Laptop", descricao: "Assinaturas de software, ferramentas na nuvem, licenças e plataformas" },
  { nome: "Compras de Insumos & Produtos", cor: "#D97706", icone: "ShoppingBag", descricao: "Aquisição de materiais, equipamentos, produtos e suprimentos" },
  { nome: "Serviços de Terceiros & Contabilidade", cor: "#0B3D91", icone: "Briefcase", descricao: "Honorários contábeis, jurídicos e consultorias especializadas" },
  { nome: "Saúde & Benefícios", cor: "#059669", icone: "Heart", descricao: "Planos de saúde (Unimed), seguros e benefícios" },
  { nome: "Infraestrutura & Telecom", cor: "#7C3AED", icone: "Wifi", descricao: "Telefonia, internet (Claro), hospedagem e energia" },
  { nome: "Despesas Gerais & Operacionais", cor: "#64748B", icone: "Tag", descricao: "Gastos administrativos diversos e custos operacionais correntes" },
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    let categorias = await prisma.expenseCategory.findMany({
      orderBy: { nome: "asc" },
    });

    // Se ainda não houver categorias no banco, inicializa com as categorias padrão sugeridas
    if (categorias.length === 0) {
      for (const def of DEFAULT_CATEGORIAS) {
        await prisma.expenseCategory.upsert({
          where: { nome: def.nome },
          update: {},
          create: def,
        });
      }
      categorias = await prisma.expenseCategory.findMany({
        orderBy: { nome: "asc" },
      });
    }

    return NextResponse.json({ items: categorias });
  } catch (error: any) {
    console.error("Erro ao listar categorias:", error);
    return NextResponse.json({ error: "Erro ao buscar categorias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { nome, cor = "#00A6FF", descricao = "", icone = "Tag" } = body;

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: "O nome da categoria é obrigatório." }, { status: 400 });
    }

    const cleanNome = nome.trim();

    const categoria = await prisma.expenseCategory.upsert({
      where: { nome: cleanNome },
      update: { cor, descricao, icone },
      create: {
        nome: cleanNome,
        cor,
        descricao,
        icone,
      },
    });

    return NextResponse.json({ success: true, item: categoria });
  } catch (error: any) {
    console.error("Erro ao cadastrar categoria:", error);
    return NextResponse.json({ error: "Erro ao criar categoria." }, { status: 500 });
  }
}
