import { z } from 'zod';
import type { Product, Sale, Debt } from './types';

// For now, we will use z.any() for base models to avoid recreating all schemas.
// A full implementation would define schemas for Product, Sale, and Debt.
const ProductSchema = z.any();
const SaleSchema = z.any();
const DebtSchema = z.any();


// --- Input Schemas and Types ---

export const FinancialAnalysisInputSchema = z.object({
  products: z.array(ProductSchema),
  sales: z.array(SaleSchema),
  debts: z.array(DebtSchema),
  currencyCode: z.string(),
});

export type FinancialAnalysisInput = {
  products: Product[];
  sales: Sale[];
  debts: Debt[];
  currencyCode: string;
};


// --- Prompt Input Schemas and Types ---

export const FinancialAnalysisPromptInputSchema = FinancialAnalysisInputSchema.extend({
  currencySymbol: z.string(),
  currentDate: z.string(),
  calculated: z.object({
    approxAssets: z.number(),
    approxLiabilities: z.number(),
    approxNetWorth: z.number(),
    totalReceivablesPending: z.number(),
    totalPayablesPending: z.number(),
    totalLoss: z.number(),
  }),
  productDetails: z.array(z.object({
      productId: z.string(),
      productName: z.string(),
      remainingQuantity: z.number(),
      lastSalePrice: z.number().optional().nullable(),
      potentialProfit: z.number().optional().nullable(),
      currentProfit: z.number(),
      totalLoss: z.number(),
  })),
});

export type FinancialAnalysisPromptInput = z.infer<typeof FinancialAnalysisPromptInputSchema>;


// --- Output Schemas and Types ---

export const FinancialAnalysisOutputSchema = z.object({
  balanceSheetSummary: z.object({
    approxAssets: z.number(),
    approxLiabilities: z.number(),
    approxNetWorth: z.number(),
    totalLoss: z.number(),
    summary: z.string(),
  }),
  debtAnalysis: z.object({
    totalReceivablesPending: z.number(),
    totalPayablesPending: z.number(),
    analysis: z.string(),
  }),
  riskAssessment: z.object({
    identifiedRisks: z.array(z.string()),
    assessment: z.string(),
  }),
  recommendations: z.object({
    suggestions: z.array(z.string()),
    priorities: z.array(z.string()),
  }),
  productAnalysis: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    remainingQuantity: z.number(),
    lastSalePrice: z.number().optional().nullable(),
    potentialProfit: z.number().optional().nullable(),
    currentProfit: z.number(),
    totalLoss: z.number(),
  })),
  overallStatus: z.enum(['healthy', 'needs_attention', 'critical']),
  disclaimer: z.string(),
});

export type FinancialAnalysisOutput = z.infer<typeof FinancialAnalysisOutputSchema>;
