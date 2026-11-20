import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addAuditLog } from "@/lib/services/audit-logger";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do anexo não informado" }, { status: 400 });
  }

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      await addAuditLog(
        "ANEXO_DOWNLOAD",
        "WARN",
        "Tentativa de acesso a anexo inexistente",
        `ID: ${id}`
      );
      return NextResponse.json({ error: "Anexo não encontrado no banco de dados." }, { status: 404 });
    }

    let fileBuffer: Buffer | null = null;

    // 1. Prioridade A: Conteúdo persistido de forma durável no banco (Cloud SQL)
    if (attachment.conteudoBase64) {
      fileBuffer = Buffer.from(attachment.conteudoBase64, "base64");
    }

    // 2. Prioridade B: Arquivo no disco local do container
    if (!fileBuffer) {
      const possiblePaths = [
        attachment.caminho,
        path.join(process.cwd(), "public", "uploads", "anexos", attachment.nomeArquivo),
        path.join(process.cwd(), "uploads", "anexos", attachment.nomeArquivo),
        path.join("/tmp", "uploads", "anexos", attachment.nomeArquivo),
      ];

      for (const p of possiblePaths) {
        if (!p) continue;
        try {
          fileBuffer = await fs.readFile(p);
          break;
        } catch {}
      }
    }

    if (!fileBuffer) {
      await addAuditLog(
        "ANEXO_DOWNLOAD",
        "WARN",
        `Anexo físico não encontrado para ${attachment.nomeOriginal}`,
        `O anexo ID ${id} existe no banco, mas seu binário não está em cache. Execute a sincronização do Gmail para persistir o arquivo.`,
        { attachmentId: id, nomeOriginal: attachment.nomeOriginal, nomeArquivo: attachment.nomeArquivo }
      );

      return NextResponse.json(
        {
          error: "Arquivo não localizado no cache temporário.",
          detalhes: `O documento "${attachment.nomeOriginal}" está registrado, mas o arquivo binário precisa ser persistido. Por favor, clique no botão azul "Verificar e Importar E-mails Agora" na aba Financeiro para que o sistema baixe e salve permanentemente este arquivo no banco de dados.`,
        },
        { status: 404 }
      );
    }

    const safeFilename = encodeURIComponent(attachment.nomeOriginal);
    const contentType = attachment.mimeType || "application/pdf";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: any) {
    await addAuditLog("ANEXO_DOWNLOAD", "ERROR", "Erro ao servir arquivo anexo", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Erro ao carregar arquivo." }, { status: 500 });
  }
}
