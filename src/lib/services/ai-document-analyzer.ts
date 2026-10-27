/**
 * Serviço de Análise Inteligente de Documentos Financeiros com IA Multimodal (Google Gemini)
 * Lê e interpreta Boletos, Notas Fiscais (PDF, Imagem, XML) e Comprovantes de Pagamento.
 */

export interface AnalyzedDocumentResult {
  tipoDocumento: "BOLETO" | "NOTA_FISCAL" | "COMPROVANTE_PAGAMENTO" | "OUTRO";
  categoriaAnexo: "BOLETO" | "DOCUMENTO" | "COMPROVANTE";
  cnpjPagador?: string;
  nomePagador?: string;
  cnpjRecebedor?: string;
  nomeRecebedor?: string;
  valor: number;
  dataVencimento?: string; // YYYY-MM-DD
  dataPagamento?: string;   // YYYY-MM-DD
  numeroDocumento?: string;
  linhaDigitavel?: string;
  chavePix?: string;
  descricao: string;
  confianca?: number;
}

export async function analyzeFinancialDocumentWithAI(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  geminiApiKey?: string
): Promise<AnalyzedDocumentResult> {
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;

  // Se não houver chave de API cadastrada, usa um parser heurístico inteligente para XML/Texto/Padrões
  if (!apiKey) {
    return heuristicDocumentParser(fileBuffer, mimeType, fileName);
  }

  try {
    const base64Data = fileBuffer.toString("base64");

    const prompt = `Você é um assistente especialista em auditoria financeira e fiscal brasileiro.
Analise este documento financeiro (que pode ser um Boleto, Nota Fiscal de Serviço/Produto ou Comprovante de Pagamento).
Identifique e extraia os dados estritamente no formato JSON com os seguintes campos:
{
  "tipoDocumento": "BOLETO" | "NOTA_FISCAL" | "COMPROVANTE_PAGAMENTO" | "OUTRO",
  "categoriaAnexo": "BOLETO" | "DOCUMENTO" | "COMPROVANTE",
  "cnpjPagador": "apenas números ou null",
  "nomePagador": "nome completo ou razão social do pagador",
  "cnpjRecebedor": "apenas números ou null (beneficiário/emissor)",
  "nomeRecebedor": "nome ou razão social do beneficiário/prestador",
  "valor": 0.00 (número float, positivo),
  "dataVencimento": "YYYY-MM-DD ou null",
  "dataPagamento": "YYYY-MM-DD ou null (se for comprovante)",
  "numeroDocumento": "número da NF, nosso número ou autenticação",
  "linhaDigitavel": "código de barras se houver ou null",
  "chavePix": "chave pix se identificada ou null",
  "descricao": "breve resumo da transação ou serviço prestado"
}
Retorne APENAS o objeto JSON puro, sem crases de markdown.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType.includes("pdf")
                      ? "application/pdf"
                      : mimeType.includes("xml")
                      ? "text/plain"
                      : mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("Falha na chamada ao Gemini API, recorrendo a heurística:", await response.text());
      return heuristicDocumentParser(fileBuffer, mimeType, fileName);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return heuristicDocumentParser(fileBuffer, mimeType, fileName);
    }

    const parsed: AnalyzedDocumentResult = JSON.parse(textOutput);
    return parsed;
  } catch (err) {
    console.error("Erro na análise via Gemini:", err);
    return heuristicDocumentParser(fileBuffer, mimeType, fileName);
  }
}

/**
 * Parser de contingência caso a chave da IA não esteja informada ou ocorra timeout
 */
function heuristicDocumentParser(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): AnalyzedDocumentResult {
  const content = fileBuffer.toString("utf-8");
  const lowerName = fileName.toLowerCase();

  const isComprovante =
    lowerName.includes("comprovante") ||
    lowerName.includes("comp_") ||
    content.includes("COMPROVANTE DE PAGAMENTO") ||
    content.includes("Comprovante de Transferência");

  const isBoleto =
    lowerName.includes("boleto") ||
    content.includes("Linha Digitável") ||
    content.includes("Recibo do Pagador") ||
    content.includes("Cedente");

  const isNotaFiscal =
    lowerName.includes("nf") ||
    lowerName.includes("danfe") ||
    lowerName.includes("nfs") ||
    content.includes("<infNFe") ||
    content.includes("<NFS-e") ||
    content.includes("Nota Fiscal");

  let tipo: "BOLETO" | "NOTA_FISCAL" | "COMPROVANTE_PAGAMENTO" | "OUTRO" = "OUTRO";
  let categoria: "BOLETO" | "DOCUMENTO" | "COMPROVANTE" = "DOCUMENTO";

  if (isComprovante) {
    tipo = "COMPROVANTE_PAGAMENTO";
    categoria = "COMPROVANTE";
  } else if (isBoleto) {
    tipo = "BOLETO";
    categoria = "BOLETO";
  } else if (isNotaFiscal) {
    tipo = "NOTA_FISCAL";
    categoria = "DOCUMENTO";
  }

  // Tenta extrair valor com regex
  const valorMatch = content.match(/R\$\s?([0-9.]+,\d{2})/i) || content.match(/valorTotal>([0-9.]+)</i);
  let valor = 0;
  if (valorMatch) {
    valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));
  }

  return {
    tipoDocumento: tipo,
    categoriaAnexo: categoria,
    valor: valor || 0,
    descricao: `Documento importado: ${fileName}`,
    dataVencimento: new Date().toISOString().slice(0, 10),
  };
}

