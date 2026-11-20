import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRecentAuditLogs, clearAuditLogs, formatLogsForPrompt } from "@/lib/services/audit-logger";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const logs = await getRecentAuditLogs(150);
    const promptMarkdown = formatLogsForPrompt(logs);

    return NextResponse.json({
      success: true,
      logs,
      promptMarkdown,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    await clearAuditLogs();
    return NextResponse.json({ success: true, message: "Logs limpos com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
