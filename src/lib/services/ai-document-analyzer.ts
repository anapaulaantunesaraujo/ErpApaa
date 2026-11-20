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
  geminiApiKey?: string,
  contextSubject?: string
): Promise<AnalyzedDocumentResult> {
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;

  // Se não houver chave de API cadastrada, usa o parser heurístico inteligente
  if (!apiKey) {
    return heuristicDocumentParser(fileBuffer, mimeType, fileName, contextSubject);
  }

  try {
    const base64Data = fileBuffer.toString("base64");

    const prompt = `Você é um assistente especialista em auditoria financeira e fiscal brasileiro.
Analise este documento financeiro (que pode ser um Boleto, Nota Fiscal de Serviço/Produto ou Comprovante de Pagamento).
Contexto do e-mail/assunto: "${contextSubject || fileName}".
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

    const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
    let textOutput = "";

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

        if (response.ok) {
          const data = await response.json();
          textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (textOutput) break;
        } else {
          console.warn(`Tentativa com modelo ${model} retornou status ${response.status}`);
        }
      } catch (callErr) {
        console.warn(`Erro chamando ${model}:`, callErr);
      }
    }

    if (!textOutput) {
      return heuristicDocumentParser(fileBuffer, mimeType, fileName, contextSubject);
    }

    const cleanJson = textOutput.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const parsed: AnalyzedDocumentResult = JSON.parse(cleanJson);
    return parsed;
  } catch (err) {
    console.error("Erro na análise via Gemini, usando heurística:", err);
    return heuristicDocumentParser(fileBuffer, mimeType, fileName, contextSubject);
  }
}

/**
 * Parser de contingência inteligente para quando a IA não estiver com chave ou para suporte offline
 */
function heuristicDocumentParser(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  contextSubject?: string
): AnalyzedDocumentResult {
  const rawUtf8 = fileBuffer.toString("utf-8");
  const rawLatin1 = fileBuffer.toString("latin1").replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, " ");
  const content = `${rawUtf8} ${rawLatin1}`;
  
  const searchCorpus = `${fileName} ${contextSubject || ""} ${content}`.toLowerCase();

  const isComprovante =
    searchCorpus.includes("comprovante") ||
    searchCorpus.includes("pagamento") ||
    searchCorpus.includes("comp_") ||
    searchCorpus.includes("transferência") ||
    searchCorpus.includes("distribuicao") ||
    searchCorpus.includes("distribuição") ||
    searchCorpus.includes("autenticação bancária") ||
    searchCorpus.includes("sicredi");

  const isBoleto =
    searchCorpus.includes("boleto") ||
    searchCorpus.includes("linha digitável") ||
    searchCorpus.includes("recibo do pagador") ||
    searchCorpus.includes("cedente") ||
    searchCorpus.includes("beneficiário");

  const isNotaFiscal =
    searchCorpus.includes("danfe") ||
    searchCorpus.includes("nfe") ||
    searchCorpus.includes("nfse") ||
    searchCorpus.includes("nfs-e") ||
    searchCorpus.includes("<infnfe") ||
    searchCorpus.includes("<nfs-e") ||
    searchCorpus.includes("nota fiscal");

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

  // Extração de valor monetário (R$ XX,XX ou similar)
  const valorMatches = content.match(/(?:R\$|VALOR|TOTAL|PAGO)?\s*([0-9]{1,3}(?:\.[0-9]{3})*,\d{2})/gi);
  let valor = 0;
  if (valorMatches && valorMatches.length > 0) {
    for (const vm of valorMatches) {
      const numStr = vm.replace(/[^0-9,]/g, "").replace(",", ".");
      const candidate = parseFloat(numStr);
      if (candidate > 0 && candidate > valor) {
        valor = candidate;
      }
    }
  }

  // Descrição refinada pelo contexto do assunto
  let desc = contextSubject || fileName;
  const lowerDesc = desc.toLowerCase();
  if (lowerDesc.includes("sicredi") && lowerDesc.includes("fatura")) {
    desc = "Pagamento de Fatura Sicredi";
  } else if (lowerDesc.includes("inss")) {
    desc = "Guia da Previdência Social (INSS)";
  } else if (lowerDesc.includes("contabilidade")) {
    desc = "Honorários de Contabilidade";
  } else if (lowerDesc.includes("unimed")) {
    desc = "Plano de Saúde Unimed";
  } else if (lowerDesc.includes("distribuicao") || lowerDesc.includes("distribuição")) {
    desc = "Distribuição de Resultados / Lucros";
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return {
    tipoDocumento: tipo,
    categoriaAnexo: categoria,
    valor: valor || 0,
    descricao: desc,
    dataVencimento: todayStr,
    dataPagamento: tipo === "COMPROVANTE_PAGAMENTO" ? todayStr : undefined,
  };
}
