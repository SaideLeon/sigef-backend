

/**
 * @fileOverview Provides AI-driven financial analysis and recommendations based on sales, product, and debt data.
 *
 * - analyzeFinances - Function to trigger the financial analysis flow.
 */

import { defineFlow, runFlow } from '@genkit-ai/flow';
import { definePrompt, generate } from '@genkit-ai/ai';
import { registry } from '../ai-instance';
import {
  FinancialAnalysisInput,
  FinancialAnalysisOutput,
  FinancialAnalysisOutputSchema,
  FinancialAnalysisPromptInputSchema,
  type FinancialAnalysisPromptInput,
} from '../../shared/types/financial-analysis'; // Import types/schemas from the new file
import {calculateUnitCost, Product, Sale, Debt} from '../../shared/types';
import {getCurrencyConfig} from '../../shared/config/currencies';
import * as z from 'zod';

const financialAnalysisPrompt = definePrompt(
  {
    name: 'financialAnalysisPrompt',
    inputSchema: FinancialAnalysisPromptInputSchema,
    outputSchema: FinancialAnalysisOutputSchema.omit({ disclaimer: true }),
  },
  async (input: z.infer<typeof FinancialAnalysisPromptInputSchema>) => {
    return {
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `Você é um consultor financeiro especialista em pequenos negócios. Analise os dados financeiros fornecidos.\n\nDados Fornecidos:\n- Data Atual: ${input.currentDate}\n- Moeda: ${input.currencyCode} (Símbolo: ${input.currencySymbol})\n- Produtos (Estoque Atual): ${JSON.stringify(input.products)}\n- Transações (Vendas e Perdas): ${JSON.stringify(input.sales)}\n- Dívidas (A Receber e A Pagar): ${JSON.stringify(input.debts)}\n- Cálculos Prévios (Aproximados): ${JSON.stringify(input.calculated)}\n- Detalhes do Produto: ${JSON.stringify(input.productDetails)}\n\nSua Tarefa:\nCom base nos dados fornecidos, gere uma análise financeira detalhada no formato JSON especificado. Siga estritamente a estrutura de saída definida (omitindo o campo 'disclaimer').\n\n1.  **Resumo Patrimonial (balanceSheetSummary):**\n    *   Use os valores pré-calculados para 'approxAssets', 'approxLiabilities', 'approxNetWorth' e 'totalLoss'.\n    *   Escreva um 'summary' breve da situação, indicando se o patrimônio é positivo ou negativo e o que isso significa de forma simples.\n\n2.  **Análise de Dívidas (debtAnalysis):**\n    *   Use os valores pré-calculados 'totalReceivablesPending' e 'totalPayablesPending'.\n    *   Analise a proporção entre contas a receber e a pagar no campo 'analysis'. Há risco de fluxo de caixa? Comente sobre a saúde das dívidas.\n    *   Considere a 'currentDate' para identificar dívidas vencidas e o risco associado.\n\n3.  **Avaliação de Riscos (riskAssessment):**\n    *   Identifique os principais riscos ('identifiedRisks') com base nos dados. Exemplos: alto volume de perdas em produtos específicos, lucro baixo ou negativo, dívidas a pagar muito altas comparadas às a receber, estoque parado (produtos sem vendas recentes - inferir se possível), dependência de poucos produtos rentáveis.\n    *   Forneça uma 'assessment' geral (ex: baixo, moderado, alto risco).\n\n4.  **Recomendações (recommendations):**\n    *   Sugira ações concretas e práticas ('suggestions') para o usuário. Exemplos: renegociar dívidas a pagar, focar em produtos mais rentáveis, estratégias para reduzir perdas, promoções para limpar estoque parado, melhorar controle de contas a receber.\n    *   Indique quais ações seriam mais prioritárias em 'priorities'.\n\n5.  **Análise de Produto (productAnalysis):**\n    *   Para cada produto em 'productDetails', crie um objeto correspondente em 'productAnalysis'.\n    *   Preencha 'productId', 'productName', 'remainingQuantity', 'lastSalePrice', 'potentialProfit', 'currentProfit' e 'totalLoss' com base nos dados de 'productDetails'.\n\n6.  **Status Geral (overallStatus):**\n    *   Classifique a saúde financeira geral como 'healthy', 'needs_attention', ou 'critical'.\n\nSeja claro, objetivo e use uma linguagem acessível para um pequeno empreendedor. Baseie TODA a análise **exclusivamente** nos dados fornecidos. Não invente informações. Se os dados forem insuficientes para alguma parte da análise, mencione isso explicitamente no texto correspondente (summary, analysis, assessment, recommendations).`,
            },
          ],
        },
      ],
    };
  }
);

export const financialAnalysisFlow = defineFlow(
  {
    name: 'financialAnalysisFlow',
    inputSchema: FinancialAnalysisPromptInputSchema,
    outputSchema: FinancialAnalysisOutputSchema,
  },
  async (input) => {
    const llmResponse = await generate(registry, {
      prompt: financialAnalysisPrompt,
      input: input,
      model: 'googleai/gemini-2.0-flash', // This needs to be a valid model reference
    });

    const output = llmResponse.output();
    if (!output) {
      throw new Error('AI prompt did not return the expected output.');
    }
    return {
      ...output,
      disclaimer:
        'Esta análise é gerada por IA e baseada exclusivamente nos dados fornecidos (produtos, vendas, dívidas). É uma ferramenta de apoio e não substitui aconselhamento financeiro profissional.',
    };
  }
);

/**
 * Prepares data and calls the Genkit flow for financial analysis.
 * @param input - The raw product, sale, and debt data along with currency code.
 * @returns A promise that resolves to the financial analysis output.
 */
export async function analyzeFinances(
  input: FinancialAnalysisInput
): Promise<FinancialAnalysisOutput> {
  const currencyConfig = getCurrencyConfig(input.currencyCode);
  const currencySymbol = currencyConfig?.symbol || input.currencyCode;

  // Calculate total pending receivables
  const totalReceivablesPending = input.debts.reduce((sum: number, debt: Debt) => {
    if (debt.type === 'receivable' && debt.status !== 'PAID') {
      return sum + (debt.amount - debt.amountPaid);
    }
    return sum;
  }, 0);

  // Calculate approximate asset value (current stock value + receivables)
  const approxAssets = input.products.reduce((total: number, product: Product) => {
    const { cost: unitCost } = calculateUnitCost(product);
    // Use current quantity for stock value
    return total + (unitCost * product.quantity);
  }, 0) + totalReceivablesPending;

  // Calculate approximate liabilities (pending payables)
  const approxLiabilities = input.debts.reduce((sum: number, debt: Debt) => {
    if (debt.type === 'payable' && debt.status !== 'PAID') {
      return sum + (debt.amount - debt.amountPaid);
    }
    return sum;
  }, 0);

  const approxNetWorth = approxAssets - approxLiabilities;

  const totalLoss = input.sales.reduce((sum: number, sale: Sale) => {
    if (sale.isLoss) {
      const product = input.products.find((p: Product) => p.id === sale.productId);
      if (product) {
        const { cost: unitCost } = calculateUnitCost(product);
        return sum + (unitCost * sale.quantitySold);
      }
    }
    return sum;
  }, 0);

  const productDetails = input.products.map((product: Product) => {
    const lastSale = input.sales
      .filter((s: Sale) => s.productId === product.id && !s.isLoss)
      .sort((a: Sale, b: Sale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    const { cost: unitCost } = calculateUnitCost(product);
    const lastSalePrice = lastSale ? lastSale.saleValue / lastSale.quantitySold : undefined;
    const potentialProfit = lastSalePrice ? (lastSalePrice - unitCost) * product.quantity : undefined;

    const currentProfit = input.sales
      .filter((s: Sale) => s.productId === product.id && !s.isLoss)
      .reduce((sum: number, sale: Sale) => sum + (sale.profit ?? 0), 0);

    const totalLossForProduct = input.sales
      .filter((s: Sale) => s.productId === product.id && s.isLoss)
      .reduce((sum: number, sale: Sale) => {
        const { cost: unitCost } = calculateUnitCost(product);
        return sum + (unitCost * sale.quantitySold);
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

  // Prepare data for the prompt, including calculated values
  const promptData: FinancialAnalysisPromptInput = {
    products: input.products,
    sales: input.sales,
    debts: input.debts,
    currencySymbol,
    currencyCode: input.currencyCode,
    currentDate: new Date().toISOString(),
    calculated: {
      approxAssets,
      approxLiabilities, // This is totalPayablesPending
      approxNetWorth,
      totalReceivablesPending,
      totalPayablesPending: approxLiabilities, // Reuse calculated liabilities
      totalLoss,
    },
    productDetails,
  };

  // Call the Genkit flow
  return runFlow(financialAnalysisFlow, promptData);
}
