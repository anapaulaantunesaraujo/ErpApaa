import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoria = (formData.get("categoria") as string) || "DOCUMENTO";
    const payableId = (formData.get("payableId") as string) || null;
    const receivableId = (formData.get("receivableId") as string) || null;
    let competencia = (formData.get("competencia") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (!competencia) {
      const now = new Date();
      competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "anexos");
    await fs.mkdir(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}_${categoria}_${safeOriginalName}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    const publicUrl = `/uploads/anexos/${uniqueFileName}`;

    await fs.writeFile(filePath, buffer);

    const attachment = await prisma.attachment.create({
      data: {
        categoria,
        nomeOriginal: file.name,
        nomeArquivo: uniqueFileName,
        caminho: filePath,
        mimeType: file.type || "application/octet-stream",
        tamanho: file.size,
        competencia,
        payableId,
        receivableId,
      },
    });

    return NextResponse.json({
      success: true,
      attachment: {
        ...attachment,
        url: publicUrl,
      },
    });
  } catch (error) {
    console.error("Erro ao salvar anexo:", error);
    return NextResponse.json({ error: "Erro ao processar anexo." }, { status: 500 });
  }
}

