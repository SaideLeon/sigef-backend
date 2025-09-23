/**
 * @fileOverview Provides AI-driven financial analysis and recommendations based on sales, product, and debt data.
 */

import { googleAI } from "@genkit-ai/google-genai";
import { genkit, z } from "genkit";
import {
  FinancialAnalysisInput,
  FinancialAnalysisOutput,
  FinancialAnalysisOutputSchema,
  FinancialAnalysisPromptInputSchema,
  type FinancialAnalysisPromptInput,
} from "../../shared/types/financial-analysis";
import {
  calculateUnitCost,
  Product,
  Sale,
  Debt,
} from "../../shared/types";
import { getCurrencyConfig } from "../../shared/config/currencies";

// Inicializa o Genkit com Gemini
const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-1.5-flash", {
    temperature: 0.8,
  }),
});

/**
 * Prompt function para gerar mensagens
 */
const financialAnalysisPrompt = async (input: FinancialAnalysisPromptInput) => {
  return `
Você é um consultor financeiro especialista em pequenos negócios. Analise os dados financeiros fornecidos.

Dados Fornecidos:
- Data Atual: ${input.currentDate}
- Moeda: ${input.currencyCode} (Símbolo: ${input.currencySymbol})
- Produtos (Estoque Atual): ${JSON.stringify(input.products)}
- Transações (Vendas e Perdas): ${JSON.stringify(input.sales)}
- Dívidas (A Receber e A Pagar): ${JSON.stringify(input.debts)}
- Cálculos Prévios (Aproximados): ${JSON.stringify(input.calculated)}
- Detalhes do Produto: ${JSON.stringify(input.productDetails)}

Sua Tarefa:
Com base nos dados fornecidos, gere uma análise financeira detalhada no formato JSON especificado.
Inclua: Resumo Patrimonial, Análise de Dívidas, Avaliação de Riscos, Recomendações, Análise de Produto e Status Geral.

Seja claro, objetivo e use uma linguagem acessível. Se faltar dado, mencione explicitamente.
`;
};

/**
 * Flow de análise financeira
 */
export const financialAnalysisFlow = ai.defineFlow(
  {
    name: "financialAnalysisFlow",
    inputSchema: FinancialAnalysisPromptInputSchema,
    outputSchema: FinancialAnalysisOutputSchema,
  },
  async (input: FinancialAnalysisPromptInput) => {
    const prompt = await financialAnalysisPrompt(input);

    const { output } = await ai.generate({
      prompt,
      output: { schema: FinancialAnalysisOutputSchema },
    });

    if (!output) {
      throw new Error("AI prompt did not return the expected output.");
    }

    return {
      ...output,
      disclaimer:
        "Esta análise é gerada por IA e baseada exclusivamente nos dados fornecidos (produtos, vendas, dívidas). É uma ferramenta de apoio e não substitui aconselhamento financeiro profissional.",
    };
  }
);

/**
 * Função principal chamada pela aplicação
 */
export async function analyzeFinances(
  input: FinancialAnalysisInput
): Promise<FinancialAnalysisOutput> {
  const currencyConfig = getCurrencyConfig(input.currencyCode);
  const currencySymbol = currencyConfig?.symbol || input.currencyCode;

  const totalReceivablesPending = input.debts.reduce(
    (sum: number, debt: Debt) => {
      if (debt.type === "receivable" && debt.status !== "PAID") {
        return sum + (debt.amount - debt.amountPaid);
      }
      return sum;
    },
    0
  );

  const approxAssets =
    input.products.reduce((total: number, product: Product) => {
      const { cost: unitCost } = calculateUnitCost(product);
      return total + unitCost * product.quantity;
    }, 0) + totalReceivablesPending;

  const approxLiabilities = input.debts.reduce(
    (sum: number, debt: Debt) => {
      if (debt.type === "payable" && debt.status !== "PAID") {
        return sum + (debt.amount - debt.amountPaid);
      }
      return sum;
    },
    0
  );

  const approxNetWorth = approxAssets - approxLiabilities;

  const totalLoss = input.sales.reduce((sum: number, sale: Sale) => {
    if (sale.isLoss) {
      const product = input.products.find(
        (p: Product) => p.id === sale.productId
      );
      if (product) {
        const { cost: unitCost } = calculateUnitCost(product);
        return sum + unitCost * sale.quantitySold;
      }
    }
    return sum;
  }, 0);

  const productDetails = input.products.map((product: Product) => {
    const lastSale = input.sales
      .filter((s: Sale) => s.productId === product.id && !s.isLoss)
      .sort(
        (a: Sale, b: Sale) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )[0];

    const { cost: unitCost } = calculateUnitCost(product);
    const lastSalePrice = lastSale
      ? lastSale.saleValue / lastSale.quantitySold
      : undefined;
    const potentialProfit = lastSalePrice
      ? (lastSalePrice - unitCost) * product.quantity
      : undefined;

    const currentProfit = input.sales
      .filter((s: Sale) => s.productId === product.id && !s.isLoss)
      .reduce((sum: number, sale: Sale) => sum + (sale.profit ?? 0), 0);

    const totalLossForProduct = input.sales
      .filter((s: Sale) => s.productId === product.id && s.isLoss)
      .reduce((sum: number, sale: Sale) => {
        const { cost: unitCost } = calculateUnitCost(product);
        return sum + unitCost * sale.quantitySold;
      }, 0);

    return {
      productId: product.id,
      productName: product.name,
      remainingQuantity: product.quantity,
      lastSalePrice,
      potentialProfit,
      currentProfit,
      totalLoss: totalLossForProduct,
    };
  });

  const promptData: FinancialAnalysisPromptInput = {
    products: input.products,
    sales: input.sales,
    debts: input.debts,
    currencySymbol,
    currencyCode: input.currencyCode,
    currentDate: new Date().toISOString(),
    calculated: {
      approxAssets,
      approxLiabilities,
      approxNetWorth,
      totalReceivablesPending,
      totalPayablesPending: approxLiabilities,
      totalLoss,
    },
    productDetails,
  };

  return financialAnalysisFlow(promptData);
}
