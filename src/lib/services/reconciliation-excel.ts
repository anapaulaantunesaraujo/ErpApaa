import ExcelJS from "exceljs";

export interface ReconciliationRow {
  data?: Date | string;
  nf?: string;
  descricao: string;
  valor?: number;
  saldo: number;
}

export interface GenerateReconciliationExcelParams {
  tituloPeriodo?: string; // Ex: "Setembro / 2026"
  saldoAnterior: number;
  itens: ReconciliationRow[];
}

/**
 * Gera um arquivo Excel (.xlsx) exatamente no padrão e identidade visual do print fornecido:
 * - Cabeçalho superior explicativo em Azul Marinho (#002060)
 * - Cabeçalho das colunas em Azul Marinho negrito
 * - Coluna D (Valor): Formatação monetária com débitos em vermelho
 * - Coluna E (Saldo): Saldo acumulado linha a linha
 */
export async function generateReconciliationExcelBuffer(
  params: GenerateReconciliationExcelParams
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ErpApaa - APAA Treinamento";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Conciliação Bancária", {
    views: [{ showGridLines: true }],
  });

  // Configuração das larguras de colunas
  worksheet.columns = [
    { key: "data", width: 16 },      // A: DATA
    { key: "nf", width: 14 },        // B: NF
    { key: "descricao", width: 55 }, // C: DESCRIÇÃO
    { key: "valor", width: 22 },     // D: VALOR
    { key: "saldo", width: 22 },     // E: SALDO
  ];

  const navyFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF002060" }, // Azul marinho escuro conforme print
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const subHeaderFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 9,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD9D9D9" } },
    left: { style: "thin", color: { argb: "FFD9D9D9" } },
    bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
    right: { style: "thin", color: { argb: "FFD9D9D9" } },
  };

  // LINHA 1: Instruções de ajuda
  const row1 = worksheet.addRow([
    "Inserir a Data que o fato ocorreu",
    "Inserir o nº da NF se houver",
    "Inserir breve descrição sobre o pagamento ou recebimento",
    "Valor deve ser exatamente igual ao extrato bancario",
    "Saldo deve ser igual ao saldo da conta bancária",
  ]);
  row1.height = 36;
  row1.eachCell((cell) => {
    cell.fill = navyFill;
    cell.font = subHeaderFont;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });

  // LINHA 2: Títulos das colunas
  const row2 = worksheet.addRow(["DATA", "NF", "DESCRIÇÃO", "VALOR", "SALDO"]);
  row2.height = 24;
  row2.eachCell((cell) => {
    cell.fill = navyFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  // LINHA 3: Saldo Anterior
  let currentSaldo = params.saldoAnterior;
  const row3 = worksheet.addRow([
    "",
    "",
    "SALDO ANTERIOR",
    "",
    currentSaldo,
  ]);
  row3.height = 20;
  row3.getCell(3).font = { name: "Calibri", size: 10, bold: true };
  row3.getCell(5).numFmt = `"R$"#,##0.00;[Red]-"R$"#,##0.00;"R$"0.00`;
  row3.getCell(5).font = { name: "Calibri", size: 10, bold: true };
  row3.getCell(5).alignment = { horizontal: "right" };
  row3.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = thinBorder;
  });

  // Formato monetário brasileiro com negativo destacado em vermelho
  const currencyNumFmt = `"R$"#,##0.00;[Red]-"R$"#,##0.00;"R$"0.00`;

  // LINHAS SUBSEQUENTES: Transações
  for (const item of params.itens) {
    let dataFormatada = "";
    if (item.data) {
      if (item.data instanceof Date) {
        const dia = String(item.data.getDate()).padStart(2, "0");
        const mes = String(item.data.getMonth() + 1).padStart(2, "0");
        const ano = item.data.getFullYear();
        dataFormatada = `${dia}/${mes}/${ano}`;
      } else {
        dataFormatada = String(item.data);
      }
    }

    if (item.valor !== undefined) {
      currentSaldo = parseFloat((currentSaldo + item.valor).toFixed(2));
    }

    const row = worksheet.addRow([
      dataFormatada,
      item.nf || "",
      item.descricao,
      item.valor !== undefined ? item.valor : "",
      item.saldo !== undefined ? item.saldo : currentSaldo,
    ]);

    row.height = 20;

    // Alinhamento e formatação
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" }; // DATA
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" }; // NF
    row.getCell(3).alignment = { horizontal: "left", vertical: "middle" };   // DESCRIÇÃO
    
    // VALOR (D)
    const valorCell = row.getCell(4);
    valorCell.alignment = { horizontal: "right", vertical: "middle" };
    valorCell.numFmt = currencyNumFmt;
    if (item.valor !== undefined && item.valor < 0) {
      valorCell.font = { name: "Calibri", size: 10, color: { argb: "FFFF0000" } }; // Vermelho
    } else {
      valorCell.font = { name: "Calibri", size: 10 };
    }

    // SALDO (E)
    const saldoCell = row.getCell(5);
    saldoCell.alignment = { horizontal: "right", vertical: "middle" };
    saldoCell.numFmt = currencyNumFmt;
    saldoCell.font = { name: "Calibri", size: 10 };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

