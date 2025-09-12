
/**
 * @fileOverview Provides AI-driven financial analysis and recommendations based on sales, product, and debt data.
 *
 * - analyzeFinances - Function to trigger the financial analysis flow.
 */

import { defineFlow, runFlow } from '@genkit-ai/flow';
import { definePrompt } from '@genkit-ai/ai';
import { registry } from '../ai-instance';
import {
  FinancialAnalysisInput,
  FinancialAnalysisOutput,
  FinancialAnalysisInputSchema,
  FinancialAnalysisOutputSchema,
  FinancialAnalysisPromptInputSchema,
  type FinancialAnalysisPromptInput,
} from '../../shared/types/financial-analysis'; // Import types/schemas from the new file
import {calculateUnitCost, Product, Sale, Debt} from '../../shared/types';
import {getCurrencyConfig} from '../../shared/config/currencies';


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

// Define the Genkit prompt (internal - DO NOT EXPORT)
const prompt = definePrompt(registry, {
  name: 'financialAnalysisPrompt',
  input: {
    schema: FinancialAnalysisPromptInputSchema, // Use the specific prompt input schema
  },
  output: {
     // Define the expected output structure for the prompt (excluding the disclaimer)
    schema: FinancialAnalysisOutputSchema.omit({disclaimer: true}),
  },
  prompt: `Você é um consultor financeiro especialista em pequenos negócios. Analise os dados financeiros fornecidos.\n\nDados Fornecidos:\n- Data Atual: {{{currentDate}}}
- Moeda: {{{currencyCode}}} (Símbolo: {{{currencySymbol}}})
- Produtos (Estoque Atual): {{json products}}
- Transações (Vendas e Perdas): {{json sales}}
- Dívidas (A Receber e A Pagar): {{json debts}}
- Cálculos Prévios (Aproximados): {{json calculated}}
  - approxAssets: Valor estimado dos ativos (estoque atual + contas a receber).
  - approxLiabilities: Total de dívidas a pagar pendentes.
  - approxNetWorth: Patrimônio líquido estimado (Ativos - Passivos).
  - totalReceivablesPending: Total de dívidas a receber pendentes.
  - totalPayablesPending: Total de dívidas a pagar pendentes (igual a approxLiabilities).
  - totalLoss: Valor total de perdas.
- Detalhes do Produto: {{json productDetails}}

Sua Tarefa:
Com base nos dados fornecidos, gere uma análise financeira detalhada no formato JSON especificado. Siga estritamente a estrutura de saída definida (omitindo o campo 'disclaimer').\n\n1.  **Resumo Patrimonial (balanceSheetSummary):**
    *   Use os valores pré-calculados para 'approxAssets', 'approxLiabilities', 'approxNetWorth' e 'totalLoss'.
    *   Escreva um 'summary' breve da situação, indicando se o patrimônio é positivo ou negativo e o que isso significa de forma simples.\n\n2.  **Análise de Dívidas (debtAnalysis):**
    *   Use os valores pré-calculados 'totalReceivablesPending' e 'totalPayablesPending'.
    *   Analise a proporção entre contas a receber e a pagar no campo 'analysis'. Há risco de fluxo de caixa? Comente sobre a saúde das dívidas.\n    *   Considere a 'currentDate' para identificar dívidas vencidas e o risco associado.\n\n3.  **Avaliação de Riscos (riskAssessment):**
    *   Identifique os principais riscos ('identifiedRisks') com base nos dados. Exemplos: alto volume de perdas em produtos específicos, lucro baixo ou negativo, dívidas a pagar muito altas comparadas às a receber, estoque parado (produtos sem vendas recentes - inferir se possível), dependência de poucos produtos rentáveis.\n    *   Forneça uma 'assessment' geral (ex: baixo, moderado, alto risco).\n\n4.  **Recomendações (recommendations):**
    *   Sugira ações concretas e práticas ('suggestions') para o usuário. Exemplos: renegociar dívidas a pagar, focar em produtos mais rentáveis, estratégias para reduzir perdas, promoções para limpar estoque parado, melhorar controle de contas a receber.\n    *   Indique quais ações seriam mais prioritárias em 'priorities'.\n\n5.  **Análise de Produto (productAnalysis):**
    *   Para cada produto em 'productDetails', crie um objeto correspondente em 'productAnalysis'.
    *   Preencha 'productId', 'productName', 'remainingQuantity', 'lastSalePrice', 'potentialProfit', 'currentProfit' e 'totalLoss' com base nos dados de 'productDetails'.\n\n6.  **Status Geral (overallStatus):**
    *   Classifique a saúde financeira geral como 'healthy', 'needs_attention', ou 'critical'.\n\nSeja claro, objetivo e use uma linguagem acessível para um pequeno empreendedor. Baseie TODA a análise **exclusivamente** nos dados fornecidos. Não invente informações. Se os dados forem insuficientes para alguma parte da análise, mencione isso explicitamente no texto correspondente (summary, analysis, assessment, recommendations).`,
});

// Define the Genkit flow (internal - DO NOT EXPORT)
// Use the specific Prompt Input Schema and the full Output Schema
const financialAnalysisFlow = defineFlow(registry, {
    name: 'financialAnalysisFlow',
    inputSchema: FinancialAnalysisPromptInputSchema, // Reference the specific prompt input schema
    outputSchema: FinancialAnalysisOutputSchema,     // Reference the full output schema
}, async (input) => {
    // Call the prompt with the prepared input data
    const { output } = await prompt(input);

    // Combine the AI output with the standard disclaimer
    // Ensure output is not null before spreading
    if (!output) {
        throw new Error("AI prompt did not return the expected output.");
    }
    return {
        ...output, // Use non-null assertion as output is expected based on schema
        disclaimer: 'Esta análise é gerada por IA e baseada exclusivamente nos dados fornecidos (produtos, vendas, dívidas). É uma ferramenta de apoio e não substitui aconselhamento financeiro profissional.',
    };
});
