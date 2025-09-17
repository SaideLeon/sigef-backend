// src/ai/tools/product-details.ts

import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { User } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export function createProductDetailsTool(user: User) {
  return tool(
    async ({ productId }) => {
      try {
        console.log(`Getting detailed product information for user ${user.email}, product:`, productId)

        const product = await prisma.product.findFirst({
          where: { 
            id: productId,
            userId: user.id // Garante que o usuário só acessa seus próprios produtos
          },
          include: {
            sales: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              include: {
                debts: true
              }
            }
          }
        })

        if (!product) {
          return JSON.stringify({ 
            error: "Produto não encontrado ou você não tem permissão para acessá-lo", 
            productId: productId 
          })
        }

        // Calcula analytics
        const totalSales = product.sales.reduce((sum, sale) => sum + sale.quantitySold, 0)
        const totalRevenue = product.sales.reduce((sum, sale) => sum + sale.saleValue, 0)
        const totalProfit = product.sales.reduce((sum, sale) => sum + (sale.profit || 0), 0)
        
        const analytics = {
          totalSales,
          totalRevenue,
          totalProfit,
          averageSaleValue: product.sales.length > 0 ? totalRevenue / product.sales.length : 0,
          stockTurnover: product.initialQuantity ? totalSales / product.initialQuantity : 0,
          currentStockValue: product.quantity * product.acquisitionValue,
          profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
        }

        // Status do estoque
        const stockPercentage = product.initialQuantity 
          ? (product.quantity / product.initialQuantity) * 100 
          : 100
        const isLowStock = stockPercentage < 20

        // Análise de tendências (últimos 30 dias)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const recentSales = product.sales.filter(sale => 
          new Date(sale.createdAt) > thirtyDaysAgo && !sale.isLoss
        )
        
        const recentTrends = {
          salesLast30Days: recentSales.reduce((sum, sale) => sum + sale.quantitySold, 0),
          revenueLast30Days: recentSales.reduce((sum, sale) => sum + sale.saleValue, 0),
          averageDailySales: recentSales.length > 0 ? 
            recentSales.reduce((sum, sale) => sum + sale.quantitySold, 0) / 30 : 0
        }

        return JSON.stringify({
          product: {
            ...product,
            stockStatus: {
              isLowStock,
              stockPercentage: stockPercentage.toFixed(1),
              status: isLowStock ? 'ESTOQUE_BAIXO' : 
                      stockPercentage < 50 ? 'ESTOQUE_MEDIO' : 'ESTOQUE_BOM'
            }
          },
          analytics,
          recentTrends,
          lastUpdated: new Date().toISOString(),
          recommendations: generateRecommendations(product, analytics, recentTrends, isLowStock)
        })

      } catch (error: any) {
        console.error("Error getting product details:", error)
        return JSON.stringify({ 
          error: "Falha ao obter detalhes do produto", 
          details: error.message 
        })
      }
    },
    {
      name: "get_product_details",
      description: "Obtém detalhes abrangentes de um produto específico incluindo histórico de vendas, análise de performance, tendências recentes e recomendações de negócio",
      schema: z.object({
        productId: z.string().describe("O ID único do produto para recuperar detalhes"),
      }),
    }
  )
}

function generateRecommendations(
  product: any, 
  analytics: any, 
  trends: any, 
  isLowStock: boolean
): string[] {
  const recommendations: string[] = []

  if (isLowStock) {
    if (trends.salesLast30Days > 0) {
      recommendations.push("🚨 URGENTE: Produto com estoque baixo e vendas ativas. Reabastecer imediatamente.")
    } else {
      recommendations.push("⚠️ Estoque baixo, mas sem vendas recentes. Avaliar demanda antes de reabastecimento.")
    }
  }

  if (analytics.profitMargin > 50) {
    recommendations.push("💰 Produto altamente lucrativo. Considerar aumentar marketing ou estoque.")
  }

  if (analytics.profitMargin < 10 && analytics.profitMargin > 0) {
    recommendations.push("📉 Margem de lucro baixa. Revisar preço de venda ou custo de aquisição.")
  }

  if (trends.salesLast30Days === 0 && product.quantity > 0) {
    recommendations.push("📊 Sem vendas nos últimos 30 dias. Considerar promoção ou liquidação.")
  }

  if (trends.averageDailySales > 1 && product.quantity < 30) {
    recommendations.push("⏰ Alta demanda detectada. Estoque atual pode não ser suficiente para os próximos 30 dias.")
  }

  if (analytics.stockTurnover > 2) {
    recommendations.push("🔄 Alta rotatividade de estoque. Produto tem boa saída - mantenha sempre em estoque.")
  }

  if (product.sales.length === 0) {
    recommendations.push("🆕 Produto novo sem histórico de vendas. Monitore performance inicial de perto.")
  }

  return recommendations
}