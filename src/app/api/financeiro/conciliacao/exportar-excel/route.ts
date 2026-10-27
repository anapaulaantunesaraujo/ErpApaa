import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateReconciliationExcelBuffer, ReconciliationRow } from "@/lib/services/reconciliation-excel";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mesParam = searchParams.get("mes");
  const anoParam = searchParams.get("ano");

  const now = new Date();
  const mes = mesParam ? parseInt(mesParam, 10) : now.getMonth() + 1;
  const ano = anoParam ? parseInt(anoParam, 10) : now.getFullYear();

  try {
    const statement = await prisma.bankStatement.findFirst({
      where: { mes, ano },
      include: {
        transacoes: {
          include: {
            payable: true,
            receivable: true,
          },
          orderBy: { data: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const saldoAnterior = statement ? statement.saldoInicial : 0;
    const itens: ReconciliationRow[] = [];

    if (statement && statement.transacoes.length > 0) {
      for (const t of statement.transacoes) {
        // Se a transação tem vínculo com conta a receber com NF, pega o número da NF
        const nf = t.receivable?.numeroNf || t.payable?.numeroDocumento || t.numeroDocumento || "";
        itens.push({
          data: t.data,
          nf: nf || undefined,
          descricao: t.descricao,
          valor: t.valor,
          saldo: t.saldo || 0,
        });
      }
    }

    const buffer = await generateReconciliationExcelBuffer({
      tituloPeriodo: `${String(mes).padStart(2, "0")}/${ano}`,
      saldoAnterior,
      itens,
    });

    const mesStr = String(mes).padStart(2, "0");
    const fileName = `Conciliacao_Bancaria_${ano}_${mesStr}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar Excel de conciliação:", error);
    return NextResponse.json(
      { error: "Erro ao gerar planilha de conciliação bancária." },
      { status: 500 }
    );
  }
}
