import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const payable = await prisma.payable.findUnique({
      where: { id },
      include: {
        anexos: true,
        baixas: true,
      },
    });

    if (!payable) {
      return NextResponse.json({ error: "Conta a pagar não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ item: payable });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const updateData: any = {};

    if (body.valorOriginal !== undefined) updateData.valorOriginal = Number(body.valorOriginal);
    if (body.valorPago !== undefined) updateData.valorPago = Number(body.valorPago);
    if (body.fornecedorNome) updateData.fornecedorNome = body.fornecedorNome;
    if (body.descricao) updateData.descricao = body.descricao;
    if (body.status) updateData.status = body.status;
    if (body.dataVencimento) updateData.dataVencimento = new Date(body.dataVencimento);
    if (body.dataPagamento) updateData.dataPagamento = new Date(body.dataPagamento);
    if (body.numeroDocumento !== undefined) updateData.numeroDocumento = body.numeroDocumento;
    if (body.categoria !== undefined) updateData.categoria = body.categoria;

    const updated = await prisma.payable.update({
      where: { id },
      data: updateData,
      include: { anexos: true, baixas: true },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.payable.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Conta a pagar removida com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
