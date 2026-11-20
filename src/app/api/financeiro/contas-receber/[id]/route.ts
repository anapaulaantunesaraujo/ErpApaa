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
    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        anexos: true,
        baixas: true,
      },
    });

    if (!receivable) {
      return NextResponse.json({ error: "Conta a receber não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ item: receivable });
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
    if (body.valorRecebido !== undefined) updateData.valorRecebido = Number(body.valorRecebido);
    if (body.clienteNome) updateData.clienteNome = body.clienteNome;
    if (body.clienteCpfCnpj !== undefined) updateData.clienteCpfCnpj = body.clienteCpfCnpj;
    if (body.descricao) updateData.descricao = body.descricao;
    if (body.status) updateData.status = body.status;
    if (body.dataVencimento) updateData.dataVencimento = new Date(body.dataVencimento);
    if (body.numeroNf !== undefined) updateData.numeroNf = body.numeroNf;

    const updated = await prisma.receivable.update({
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
    await prisma.paymentRecord.deleteMany({
      where: { receivableId: id },
    });

    await prisma.attachment.deleteMany({
      where: { receivableId: id },
    });

    await prisma.receivable.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Conta a receber removida com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
