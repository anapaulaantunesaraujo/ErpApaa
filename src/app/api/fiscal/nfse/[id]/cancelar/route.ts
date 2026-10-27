import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cancelarNfseAmbienteNacional } from "@/lib/services/nfse-nacional-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { codigoMotivo = "1", justificativa } = body;

    if (!justificativa || justificativa.trim().length < 15) {
      return NextResponse.json(
        { error: "A justificativa de cancelamento deve ter pelo menos 15 caracteres (exigência da Receita Federal / CGNFSE)." },
        { status: 400 }
      );
    }

    const nfse = await prisma.nfseEmission.findUnique({
      where: { id },
      include: {
        receivable: true,
        cliente: true,
        servico: true,
      },
    });

    if (!nfse) {
      return NextResponse.json({ error: "Nota Fiscal não encontrada." }, { status: 404 });
    }

    if (nfse.status === "CANCELADA") {
      return NextResponse.json(
        { error: "Esta Nota Fiscal já está oficialmente cancelada." },
        { status: 400 }
      );
    }

    const settings = await prisma.companySettings.findFirst();
    const cnpjEmitente = settings?.cnpj || "50.756.275/0001-28";

    // 1. Executa a integração com o Ambiente Nacional da NFS-e (Evento 101101)
    const cancelamentoNacional = await cancelarNfseAmbienteNacional({
      chaveAcesso: nfse.chaveAcesso || `NFS2026${cnpjEmitente.replace(/\D/g, "")}${nfse.numeroNfse}`,
      numeroNfse: nfse.numeroNfse || "000000",
      cnpjEmitente,
      codigoMotivo: String(codigoMotivo),
      justificativa: justificativa.trim(),
    });

    const now = new Date();
    const dataFormatada = now.toLocaleString("pt-BR");

    // 2. Atualiza no banco em transação: cancela a NFS-e e anula o Contas a Receber
    const result = await prisma.$transaction(async (tx) => {
      // Atualiza a Nota Fiscal para CANCELADA
      const nfseAtualizada = await tx.nfseEmission.update({
        where: { id: nfse.id },
        data: {
          status: "CANCELADA",
          dataCancelamento: now,
          codigoMotivoCancelamento: String(codigoMotivo),
          motivoCancelamento: justificativa.trim(),
          protocoloCancelamento: cancelamentoNacional.protocoloCancelamento,
          xmlCancelamento: cancelamentoNacional.xmlCancelamento,
        },
      });

      // Se existir o título de Contas a Receber atrelado, cancela para não cobrar o cliente
      let receivableAtualizado = null;
      if (nfse.receivable) {
        receivableAtualizado = await tx.receivable.update({
          where: { id: nfse.receivable.id },
          data: {
            status: "CANCELADO",
            observacoes: `${nfse.receivable.observacoes || ""} [NFS-e CANCELADA no Ambiente Nacional em ${dataFormatada} - Protocolo: ${cancelamentoNacional.protocoloCancelamento} - Motivo: ${justificativa.trim()}]`,
          },
        });
      }

      return { nfseAtualizada, receivableAtualizado };
    });

    return NextResponse.json({
      success: true,
      message: cancelamentoNacional.mensagem,
      protocolo: cancelamentoNacional.protocoloCancelamento,
      nfse: result.nfseAtualizada,
      receivable: result.receivableAtualizado,
    });
  } catch (error: any) {
    console.error("Erro ao cancelar NFS-e:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar cancelamento no Ambiente Nacional da NFS-e." },
      { status: 500 }
    );
  }
}

