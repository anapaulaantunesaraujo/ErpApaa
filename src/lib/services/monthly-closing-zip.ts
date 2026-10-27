import { PassThrough } from "stream";
import fs from "fs";
const archiver = require("archiver");

export interface ClosingFileEntry {
  name: string;
  buffer?: Buffer;
  path?: string;
}

export interface GenerateMonthlyClosingZipParams {
  ano: number;
  mes: number;
  excelBuffer: Buffer;
  extratoFiles: ClosingFileEntry[];
  nfsEmitidasFiles: ClosingFileEntry[];
  boletosNfsPagarFiles: ClosingFileEntry[];
  comprovantesFiles: ClosingFileEntry[];
}

/**
 * Empacota o fechamento mensal da APAA Treinamento com a hierarquia de pastas exigida:
 * - Raiz: Conciliacao_Bancaria_YYYY_MM.xlsx
 * - Extrato/ (.ofx, .txt, .pdf)
 * - NFs emitidas/
 * - Boletos e NFs a pagar/
 * - Comprovantes/
 */
export async function generateMonthlyClosingZip(
  params: GenerateMonthlyClosingZipParams
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err: any) => reject(err));
    archive.on("error", (err: any) => reject(err));

    archive.pipe(stream);

    const mesStr = String(params.mes).padStart(2, "0");
    const excelName = `Conciliacao_Bancaria_${params.ano}_${mesStr}.xlsx`;

    // 1. Planilha de conciliação bancária na raiz
    archive.append(params.excelBuffer, { name: excelName });

    // Função auxiliar para adicionar arquivo a partir de buffer ou caminho em disco
    const addFilesToFolder = (files: ClosingFileEntry[], folderName: string) => {
      for (const file of files) {
        const fullZipPath = `${folderName}/${file.name}`;
        if (file.buffer) {
          archive.append(file.buffer, { name: fullZipPath });
        } else if (file.path && fs.existsSync(file.path)) {
          archive.file(file.path, { name: fullZipPath });
        }
      }
    };

    // 2. Subpastas conforme especificação exata
    addFilesToFolder(params.extratoFiles, "Extrato");
    addFilesToFolder(params.nfsEmitidasFiles, "NFs emitidas");
    addFilesToFolder(params.boletosNfsPagarFiles, "Boletos e NFs a pagar");
    addFilesToFolder(params.comprovantesFiles, "Comprovantes");

    archive.finalize();
  });
}

