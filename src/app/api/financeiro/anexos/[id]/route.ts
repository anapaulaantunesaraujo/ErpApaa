import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
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

    // Busca o arquivo em múltiplos caminhos possíveis
    const possiblePaths = [
      attachment.caminho,
      path.join(process.cwd(), "public", "uploads", "anexos", attachment.nomeArquivo),
      path.join(process.cwd(), "uploads", "anexos", attachment.nomeArquivo),
      path.join("/tmp", "uploads", "anexos", attachment.nomeArquivo),
    ];

    let fileBuffer: Buffer | null = null;

    for (const p of possiblePaths) {
      if (!p) continue;
      try {
        fileBuffer = await fs.readFile(p);
        break;
      } catch {
        // Tenta próximo caminho
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error: "Arquivo físico não encontrado no servidor de arquivos.",
          detalhes: `O registro existe no banco (${attachment.nomeOriginal}), mas o arquivo não está no caminho indicado.`,
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
      },
    });
  } catch (err: any) {
    console.error("Erro ao servir anexo:", err);
    return NextResponse.json({ error: err.message || "Erro ao carregar arquivo." }, { status: 500 });
  }
}
