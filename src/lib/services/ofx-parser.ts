/**
 * Parser de arquivos OFX (Open Financial Exchange) otimizado para o formato Sicredi e bancos brasileiros.
 * Suporta formatos SGML e XML.
 */

export interface OfxTransaction {
  fitid: string;
  type: "DEBIT" | "CREDIT" | "OTHER";
  date: Date;
  amount: number;
  memo: string;
  checkNumber?: string;
}

export interface OfxStatement {
  bankId?: string;
  accountNumber?: string;
  startDate?: Date;
  endDate?: Date;
  openingBalance?: number;
  closingBalance?: number;
  transactions: OfxTransaction[];
}

function parseOfxDate(dateStr: string): Date {
  // Formato típico: YYYYMMDDHHMMSS ou YYYYMMDD ou YYYYMMDDHHMMSS[-3:BRT]
  const clean = dateStr.replace(/\[.*\]/, "").trim();
  const year = parseInt(clean.substring(0, 4), 10);
  const month = parseInt(clean.substring(4, 6), 10) - 1;
  const day = parseInt(clean.substring(6, 8), 10);
  const hours = clean.length >= 10 ? parseInt(clean.substring(8, 10), 10) : 12;
  const minutes = clean.length >= 12 ? parseInt(clean.substring(10, 12), 10) : 0;
  const seconds = clean.length >= 14 ? parseInt(clean.substring(12, 14), 10) : 0;

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

function extractTagValue(xmlBlock: string, tag: string): string | null {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const openIdx = xmlBlock.indexOf(openTag);
  if (openIdx === -1) return null;

  const contentStart = openIdx + openTag.length;
  const closeIdx = xmlBlock.indexOf(closeTag, contentStart);

  if (closeIdx !== -1) {
    return xmlBlock.substring(contentStart, closeIdx).trim();
  }

  // Se for SGML sem tag de fechamento, pega até a próxima quebra de linha ou próximo <
  const nextTagIdx = xmlBlock.indexOf("<", contentStart);
  const lineEndIdx = xmlBlock.indexOf("\n", contentStart);
  const end =
    nextTagIdx !== -1 && lineEndIdx !== -1
      ? Math.min(nextTagIdx, lineEndIdx)
      : nextTagIdx !== -1
      ? nextTagIdx
      : lineEndIdx !== -1
      ? lineEndIdx
      : xmlBlock.length;

  return xmlBlock.substring(contentStart, end).trim();
}

export function parseOfx(ofxContent: string): OfxStatement {
  // Isola a seção de dados após os cabeçalhos SGML
  const ofxStart = ofxContent.indexOf("<OFX>");
  const content = ofxStart !== -1 ? ofxContent.substring(ofxStart) : ofxContent;

  const bankId = extractTagValue(content, "BANKID") || undefined;
  const accountNumber = extractTagValue(content, "ACCTID") || undefined;

  // Datas de início e fim do extrato
  const dtStartStr = extractTagValue(content, "DTSTART");
  const dtEndStr = extractTagValue(content, "DTEND");
  const startDate = dtStartStr ? parseOfxDate(dtStartStr) : undefined;
  const endDate = dtEndStr ? parseOfxDate(dtEndStr) : undefined;

  // Saldo final (LEDGERBAL)
  const ledgerBalBlock = content.match(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/i)?.[0] || content;
  const balAmtStr = extractTagValue(ledgerBalBlock, "BALAMT");
  const closingBalance = balAmtStr ? parseFloat(balAmtStr.replace(",", ".")) : undefined;

  // Extrai as transações (<STMTTRN>)
  const transactions: OfxTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const trnBlock = match[1];

    const trnType = (extractTagValue(trnBlock, "TRNTYPE") || "").toUpperCase();
    const dtPostedStr = extractTagValue(trnBlock, "DTPOSTED");
    const trnAmtStr = extractTagValue(trnBlock, "TRNAMT");
    const fitid = extractTagValue(trnBlock, "FITID") || `trn_${Date.now()}_${Math.random()}`;
    const memo = extractTagValue(trnBlock, "MEMO") || extractTagValue(trnBlock, "NAME") || "Sem descrição";
    const checkNumber = extractTagValue(trnBlock, "CHECKNUM") || undefined;

    if (dtPostedStr && trnAmtStr) {
      const amount = parseFloat(trnAmtStr.replace(",", "."));
      const date = parseOfxDate(dtPostedStr);

      transactions.push({
        fitid,
        type: amount < 0 ? "DEBIT" : "CREDIT",
        date,
        amount,
        memo,
        checkNumber,
      });
    }
  }

  // Ordena por data crescente
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calcula o saldo inicial aproximado caso não venha no arquivo
  let openingBalance = closingBalance;
  if (openingBalance !== undefined) {
    const totalMovimentado = transactions.reduce((acc, t) => acc + t.amount, 0);
    openingBalance = parseFloat((openingBalance - totalMovimentado).toFixed(2));
  }

  return {
    bankId,
    accountNumber,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    transactions,
  };
}

