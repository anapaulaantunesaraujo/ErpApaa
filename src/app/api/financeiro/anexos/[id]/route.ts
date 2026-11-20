import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchAttachmentBufferFromGmail } from "@/lib/services/gmail-sync-service";
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
      return NextResponse.json({ error: "Anexo não encontrado no banco de dados." }, { status: 404 });
    }

    let fileBuffer: Buffer | null = null;

    // 1. Prioridade A: Conteúdo armazenado diretamente no banco (durável no Cloud Run)
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

    // 3. Prioridade C: Recuperação sob demanda diretamente do Gmail IMAP
    if (!fileBuffer && attachment.nomeOriginal) {
      const fetched = await fetchAttachmentBufferFromGmail(attachment.nomeOriginal);
      if (fetched) {
        fileBuffer = fetched.buffer;

        // Persiste no banco e no disco para as próximas requisições serem instantâneas
        try {
          const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
          await fs.mkdir(uploadDir, { recursive: true });
          const diskPath = path.join(uploadDir, attachment.nomeArquivo);
          await fs.writeFile(diskPath, fileBuffer);

          await prisma.attachment.update({
            where: { id: attachment.id },
            data: {
              conteudoBase64: fileBuffer.toString("base64"),
              caminho: diskPath,
            },
          });
        } catch (saveErr) {
          console.warn("Aviso ao salvar anexo recuperado do Gmail:", saveErr);
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error: "Arquivo não localizado no disco nem no Gmail.",
          detalhes: `Registro: ${attachment.nomeOriginal}. Tente clicar em 'Verificar e Importar E-mails' para re-sincronizar.`,
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
    console.error("Erro ao servir anexo:", err);
    return NextResponse.json({ error: err.message || "Erro ao carregar arquivo." }, { status: 500 });
  }
}
