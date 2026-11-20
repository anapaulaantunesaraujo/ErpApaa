import { prisma } from "@/lib/prisma";

export interface AuditLogEntry {
  id: string;
  tipo: "GMAIL_SYNC" | "ANEXO_DOWNLOAD" | "IA_EXTRACAO" | "SISTEMA";
  nivel: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  titulo: string;
  mensagem: string;
  detalhes?: string | null;
  createdAt: Date;
}

let tableEnsured = false;

export async function ensureAuditLogTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS import_audit_logs (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        nivel TEXT NOT NULL,
        titulo TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        detalhes TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableEnsured = true;
  } catch (err: any) {
    console.warn("Aviso ao criar tabela import_audit_logs:", err.message);
  }
}

export async function addAuditLog(
  tipo: "GMAIL_SYNC" | "ANEXO_DOWNLOAD" | "IA_EXTRACAO" | "SISTEMA",
  nivel: "INFO" | "WARN" | "ERROR" | "SUCCESS",
  titulo: string,
  mensagem: string,
  detalhes?: any
): Promise<void> {
  try {
    await ensureAuditLogTable();

    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const detalhesStr = detalhes
      ? typeof detalhes === "string"
        ? detalhes
        : JSON.stringify(detalhes, null, 2)
      : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO import_audit_logs (id, tipo, nivel, titulo, mensagem, detalhes, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
      id,
      tipo,
      nivel,
      titulo,
      mensagem,
      detalhesStr
    );
  } catch (err: any) {
    console.error("Falha ao salvar log de auditoria:", err.message);
  }
}

export async function getRecentAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  try {
    await ensureAuditLogTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, tipo, nivel, titulo, mensagem, detalhes, "createdAt"
       FROM import_audit_logs
       ORDER BY "createdAt" DESC
       LIMIT $1;`,
      limit
    );
    return rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      nivel: r.nivel,
      titulo: r.titulo,
      mensagem: r.mensagem,
      detalhes: r.detalhes,
      createdAt: new Date(r.createdAt),
    }));
  } catch (err: any) {
    console.error("Erro ao buscar logs de auditoria:", err.message);
    return [];
  }
}

export async function clearAuditLogs(): Promise<void> {
  try {
    await ensureAuditLogTable();
    await prisma.$executeRawUnsafe(`DELETE FROM import_audit_logs;`);
  } catch (err: any) {
    console.error("Erro ao limpar logs de auditoria:", err.message);
  }
}

/**
 * Formata os logs em um relatório Markdown pronto para ser enviado ao assistente de IA.
 */
export function formatLogsForPrompt(logs: AuditLogEntry[]): string {
  if (logs.length === 0) {
    return "Nenhum log de importação registrado até o momento.";
  }

  const lines: string[] = [];
  lines.push("# RELATÓRIO TÉCNICO DE IMPORTAÇÃO & SINCRONIZAÇÃO - ERP APAA");
  lines.push(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  lines.push(`Total de eventos registrados: ${logs.length}\n`);

  lines.push("## Resumo Cronológico de Eventos (Mais recentes primeiro):\n");

  for (const log of logs) {
    const dataFormatada = new Date(log.createdAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const badge =
      log.nivel === "ERROR"
        ? "[ERRO ❌]"
        : log.nivel === "WARN"
        ? "[ALERTA ⚠️]"
        : log.nivel === "SUCCESS"
        ? "[SUCESSO ✅]"
        : "[INFO ℹ️]";

    lines.push(`- **${dataFormatada}** ${badge} **[${log.tipo}] ${log.titulo}**`);
    lines.push(`  ${log.mensagem}`);
    if (log.detalhes) {
      lines.push("  ```json");
      lines.push(
        log.detalhes
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")
      );
      lines.push("  ```");
    }
  }

  return lines.join("\n");
}
