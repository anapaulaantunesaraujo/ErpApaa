import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sincronizarEmailsMarcadorGmail } from "@/lib/services/gmail-sync-service";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const syncResult = await sincronizarEmailsMarcadorGmail();

    return NextResponse.json({
      success: true,
      data: syncResult,
      message: `Sincronização concluída: ${syncResult.totalEmailsProcessados} e-mails lidos, ${syncResult.totalAnexosProcessados} anexos processados, ${syncResult.contasPagarCriadas} contas a pagar, ${syncResult.contasReceberCriadas} contas a receber e ${syncResult.baixasEfetuadas} baixas automáticas.`,
    });
  } catch (error: any) {
    console.error("Erro na sincronização de e-mails:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao conectar e sincronizar e-mails do Gmail." },
      { status: 500 }
    );
  }
}
