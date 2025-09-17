// src/ai/tools/inventory-analytics.ts

import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { User } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export function createInventoryAnalyticsTool(user: User) {
  return tool(
    async ({ analysisType = "overview", dateRange = 30 }) => {
      try {
        console.log(`Performing inventory analysis for user ${user.email}:`, analysisType)

        const dateFilter = new Date()
        dateFilter.setDate(dateFilter.getDate() - dateRange)

        switch (analysisType) {
          case "overview":
            return JSON.stringify(await generateOverviewAnalysis(user, dateFilter))
          
          case "low_stock":
            return JSON.stringify(await generateLowStockAnalysis(user))
          
          case "sales_performance":
            return JSON.stringify(await generateSalesPerformanceAnalysis(user, dateFilter))
          
          case "profit_analysis":
            return JSON.stringify(await generateProfitAnalysis(user, dateFilter))
          
          case "debt_summary":
            return JSON.stringify(await generateDebtSummary(user))
          
          case "trending_products":
            return JSON.stringify(await generateTrendingProductsAnalysis(user, dateFilter))

          default:
            return JSON.stringify({ error: "Tipo de análise desconhecido" })
        }

      } catch (error: any) {
        console.error("Error in inventory analytics:", error)
        return JSON.stringify({ 
          error: "Falha ao gerar analytics", 
          details: error.message 
        })
      }
    },
    {
      name: "inventory_analytics",
      description: "Fornece análises abrangentes de inventário incluindo visão geral, alertas de estoque baixo, performance de vendas, análise de lucros, resumo de dívidas e produtos em tendência",
      schema: z.object({
        analysisType: z.enum([
          "overview", 
          "low_stock", 
          "sales_performance", 
          "profit_analysis", 
          "debt_summary",
          "trending_products"
        ])
          .optional()
          .default("overview")
          .describe("Tipo de análise para executar"),
        dateRange: z.number()
          .optional()
          .default(30)
          .describe("Período em dias para análise (padrão: 30 dias)"),
      }),
    }
  )
}

async function generateOverviewAnalysis(user: User, dateFilter: Date) {
  const [products, recentSales, debts] = await Promise.all([
    prisma.product.findMany({
      where: { userId: user.id },
      include: { sales: true }
    }),
    prisma.sale.findMany({
      where: { 
        userId: user.id,
        createdAt: { gte: dateFilter }
      }
    }),
    prisma.debt.findMany({
      where: { userId: user.id }
    })
  ])

  const totalProducts = products.length
  const totalStockValue = products.reduce((sum, p) => {
    const unitCost = p.initialQuantity ? p.acquisitionValue / p.initialQuantity : p.acquisitionValue
    return sum + (unitCost * p.quantity)
  }, 0)

  const lowStockProducts = products.filter(p => {
    const stockPercentage = p.initialQuantity ? (p.quantity / p.initialQuantity) * 100 : 100
    return stockPercentage < 20
  })

  const recentRevenue = recentSales.reduce((sum, s) => sum + s.saleValue, 0)
  const recentProfit = recentSales.reduce((sum, s) => sum + (s.profit || 0), 0)

  const pendingReceivables = debts
    .filter(d => d.type === 'receivable' && d.status !== 'PAID')
    .reduce((sum, d) => sum + (d.amount - d.amountPaid), 0)

  const pendingPayables = debts
    .filter(d => d.type === 'payable' && d.status !== 'PAID')
    .reduce((sum, d) => sum + (d.amount - d.amountPaid), 0)

  const topSellingProducts = products
    .map(p => ({
      ...p,
      totalSold: p.sales.reduce((sum, s) => sum + s.quantitySold, 0),
      totalRevenue: p.sales.reduce((sum, s) => sum + s.saleValue, 0)
    }))
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 5)

  return {
    analysisType: "overview",
    summary: {
      totalProducts,
      totalStockValue: totalStockValue.toFixed(2),
      lowStockCount: lowStockProducts.length,
      recentRevenue: recentRevenue.toFixed(2),
      recentProfit: recentProfit.toFixed(2),
      profitMargin: recentRevenue > 0 ? ((recentProfit / recentRevenue) * 100).toFixed(1) : "0",
      pendingReceivables: pendingReceivables.toFixed(2),
      pendingPayables: pendingPayables.toFixed(2),
      netCashFlow: (pendingReceivables - pendingPayables).toFixed(2)
    },
    lowStockAlerts: lowStockProducts.map(p => ({
      id: p.id,
      name: p.name,
      currentQuantity: p.quantity,
      stockPercentage: p.initialQuantity ? ((p.quantity / p.initialQuantity) * 100).toFixed(1) : "100"
    })),
    topProducts: topSellingProducts.map(p => ({
      id: p.id,
      name: p.name,
      totalSold: p.totalSold,
      totalRevenue: p.totalRevenue.toFixed(2),
      currentStock: p.quantity
    })),
    generatedAt: new Date().toISOString(),
    recommendations: generateOverviewRecommendations(totalStockValue, lowStockProducts.length, recentProfit, pendingReceivables, pendingPayables)
  }
}

async function generateLowStockAnalysis(user: User) {
  const products = await prisma.product.findMany({
    where: { userId: user.id },
    include: {
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  })

  const lowStockProducts = products.filter(p => {
    const stockPercentage = p.initialQuantity ? (p.quantity / p.initialQuantity) * 100 : 100
    return stockPercentage < 20
  })

  const criticalStock = lowStockProducts.filter(p => p.quantity <= 5)
  const moderateStock = lowStockProducts.filter(p => p.quantity > 5 && p.quantity <= 15)

  return {
    analysisType: "low_stock",
    summary: {
      totalLowStock: lowStockProducts.length,
      criticalStock: criticalStock.length,
      moderateStock: moderateStock.length
    },
    criticalStockProducts: criticalStock.map(p => ({
      id: p.id,
      name: p.name,
      currentQuantity: p.quantity,
      stockLevel: p.quantity <= 2 ? "CRÍTICO" : "MUITO_BAIXO",
      lastSales: p.sales.slice(0, 3).map(s => ({
        date: s.createdAt.toISOString(),
        quantity: s.quantitySold,
        value: s.saleValue
      })),
      recommendation: p.sales.length > 0 ? "Reabastecimento URGENTE - produto tem demanda" : "Avaliar demanda antes de reabastecimento"
    })),
    moderateStockProducts: moderateStock.map(p => ({
      id: p.id,
      name: p.name,
      currentQuantity: p.quantity,
      stockLevel: "BAIXO",
      recommendation: "Planejar reabastecimento em breve"
    })),
    generatedAt: new Date().toISOString()
  }
}

async function generateSalesPerformanceAnalysis(user: User, dateFilter: Date) {
  const sales = await prisma.sale.findMany({
    where: { 
      userId: user.id,
      createdAt: { gte: dateFilter },
      isLoss: false
    },
    include: {
      product: true
    }
  })

  const losses = await prisma.sale.findMany({
    where: { 
      userId: user.id,
      createdAt: { gte: dateFilter },
      isLoss: true
    }
  })

  const totalSales = sales.length
  const totalRevenue = sales.reduce((sum, s) => sum + s.saleValue, 0)
  const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0)
  const totalLosses = losses.reduce((sum, s) => {
    const product = s.product || { acquisitionValue: 0, initialQuantity: 1 }
    const unitCost = product.initialQuantity ? product.acquisitionValue / product.initialQuantity : product.acquisitionValue
    return sum + (unitCost * s.quantitySold)
  }, 0)

  const productPerformance = sales
    .reduce((acc, sale) => {
      const existing = acc.find(p => p.productId === sale.productId)
      if (existing) {
        existing.totalSales += sale.quantitySold
        existing.totalRevenue += sale.saleValue
        existing.totalProfit += (sale.profit || 0)
        existing.salesCount += 1
      } else {
        acc.push({
          productId: sale.productId,
          productName: sale.productName,
          totalSales: sale.quantitySold,
          totalRevenue: sale.saleValue,
          totalProfit: (sale.profit || 0),
          salesCount: 1
        })
      }
      return acc
    }, [] as any[])
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10)

  return {
    analysisType: "sales_performance",
    period: `Últimos ${Math.ceil((Date.now() - dateFilter.getTime()) / (1000 * 60 * 60 * 24))} dias`,
    summary: {
      totalSales,
      totalRevenue: totalRevenue.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalLosses: totalLosses.toFixed(2),
      netProfit: (totalProfit - totalLosses).toFixed(2),
      averageSaleValue: totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : "0",
      profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0"
    },
    topPerformers: productPerformance,
    lossAnalysis: {
      totalLossTransactions: losses.length,
      totalLossValue: totalLosses.toFixed(2),
      commonReasons: losses.reduce((acc, loss) => {
        const reason = loss.lossReason || "Não especificado"
        acc[reason] = (acc[reason] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    },
    generatedAt: new Date().toISOString()
  }
}

async function generateProfitAnalysis(user: User, dateFilter: Date) {
  const sales = await prisma.sale.findMany({
    where: { 
      userId: user.id,
      createdAt: { gte: dateFilter }
    },
    include: { product: true }
  })

  const profitBySale = sales.map(sale => ({
    date: sale.createdAt.toISOString(),
    productName: sale.productName,
    quantity: sale.quantitySold,
    revenue: sale.saleValue,
    profit: sale.profit || 0,
    profitMargin: sale.saleValue > 0 ? ((sale.profit || 0) / sale.saleValue * 100) : 0,
    isLoss: sale.isLoss
  }))

  const dailyProfits = profitBySale.reduce((acc, sale) => {
    const date = sale.date.split('T')[0]
    if (!acc[date]) {
      acc[date] = { revenue: 0, profit: 0, sales: 0 }
    }
    acc[date].revenue += sale.revenue
    acc[date].profit += sale.profit
    acc[date].sales += 1
    return acc
  }, {} as Record<string, any>)

  const bestDays = Object.entries(dailyProfits)
    .sort(([,a], [,b]) => b.profit - a.profit)
    .slice(0, 5)
    .map(([date, data]) => ({
      date,
      revenue: data.revenue.toFixed(2),
      profit: data.profit.toFixed(2),
      sales: data.sales
    }))

  return {
    analysisType: "profit_analysis",
    period: `Últimos ${Math.ceil((Date.now() - dateFilter.getTime()) / (1000 * 60 * 60 * 24))} dias`,
    summary: {
      totalProfit: profitBySale.reduce((sum, s) => sum + s.profit, 0).toFixed(2),
      averageDailyProfit: (profitBySale.reduce((sum, s) => sum + s.profit, 0) / Object.keys(dailyProfits).length).toFixed(2),
      highestMarginSale: Math.max(...profitBySale.map(s => s.profitMargin)).toFixed(1),
      lowestMarginSale: Math.min(...profitBySale.map(s => s.profitMargin)).toFixed(1)
    },
    bestPerformingDays: bestDays,
    profitTrends: {
      increasingTrend: "Análise de tendência requer mais dados históricos",
      recommendation: "Foque nos produtos e dias de melhor performance para maximizar lucros"
    },
    generatedAt: new Date().toISOString()
  }
}

async function generateDebtSummary(user: User) {
  const debts = await prisma.debt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  })

  const receivables = debts.filter(d => d.type === 'receivable')
  const payables = debts.filter(d => d.type === 'payable')

  const pendingReceivables = receivables.filter(d => d.status !== 'PAID')
  const pendingPayables = payables.filter(d => d.status !== 'PAID')

  const overdueReceivables = pendingReceivables.filter(d => 
    d.dueDate && new Date(d.dueDate) < new Date()
  )

  const overduePayables = pendingPayables.filter(d => 
    d.dueDate && new Date(d.dueDate) < new Date()
  )

  return {
    analysisType: "debt_summary",
    receivables: {
      total: receivables.length,
      totalAmount: receivables.reduce((sum, d) => sum + d.amount, 0).toFixed(2),
      pending: pendingReceivables.length,
      pendingAmount: pendingReceivables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0).toFixed(2),
      overdue: overdueReceivables.length,
      overdueAmount: overdueReceivables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0).toFixed(2)
    },
    payables: {
      total: payables.length,
      totalAmount: payables.reduce((sum, d) => sum + d.amount, 0).toFixed(2),
      pending: pendingPayables.length,
      pendingAmount: pendingPayables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0).toFixed(2),
      overdue: overduePayables.length,
      overdueAmount: overduePayables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0).toFixed(2)
    },
    netPosition: {
      amount: (
        pendingReceivables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0) -
        pendingPayables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0)
      ).toFixed(2),
      status: pendingReceivables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0) > 
               pendingPayables.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0) ? 
               "Posição positiva" : "Posição negativa"
    },
    urgentActions: [
      ...(overdueReceivables.length > 0 ? [`Cobrar ${overdueReceivables.length} contas a receber vencidas`] : []),
      ...(overduePayables.length > 0 ? [`Quitar ${overduePayables.length} contas a pagar vencidas`] : [])
    ],
    generatedAt: new Date().toISOString()
  }
}

async function generateTrendingProductsAnalysis(user: User, dateFilter: Date) {
  const recentSales = await prisma.sale.findMany({
    where: { 
      userId: user.id,
      createdAt: { gte: dateFilter },
      isLoss: false
    },
    include: { product: true }
  })

  const productTrends = recentSales
    .reduce((acc, sale) => {
      const existing = acc.find(p => p.productId === sale.productId)
      if (existing) {
        existing.salesCount += 1
        existing.totalQuantity += sale.quantitySold
        existing.totalRevenue += sale.saleValue
        existing.dates.push(sale.createdAt)
      } else {
        acc.push({
          productId: sale.productId,
          productName: sale.productName,
          salesCount: 1,
          totalQuantity: sale.quantitySold,
          totalRevenue: sale.saleValue,
          currentStock: sale.product?.quantity || 0,
          dates: [sale.createdAt]
        })
      }
      return acc
    }, [] as any[])

  const trending = productTrends
    .map(p => ({
      ...p,
      averageFrequency: p.salesCount / ((Date.now() - Math.min(...p.dates.map(d => d.getTime()))) / (1000 * 60 * 60 * 24)),
      trendScore: p.salesCount * p.totalQuantity * p.averageFrequency
    }))
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 10)

  return {
    analysisType: "trending_products",
    period: `Últimos ${Math.ceil((Date.now() - dateFilter.getTime()) / (1000 * 60 * 60 * 24))} dias`,
    trendingProducts: trending.map(p => ({
      productId: p.productId,
      productName: p.productName,
      salesCount: p.salesCount,
      totalQuantity: p.totalQuantity,
      totalRevenue: p.totalRevenue.toFixed(2),
      currentStock: p.currentStock,
      trendStatus: p.currentStock < 10 && p.salesCount > 2 ? "REABASTECER_URGENTE" : 
                   p.salesCount > 5 ? "EM_ALTA" : "CRESCENDO",
      recommendation: p.currentStock < 10 && p.salesCount > 2 ? 
                     "Produto em alta demanda com estoque baixo - reabastecer imediatamente" :
                     "Produto com boa performance - manter em estoque"
    })),
    insights: {
      hotProducts: trending.filter(p => p.salesCount > 5).length,
      needRestock: trending.filter(p => p.currentStock < 10 && p.salesCount > 2).length,
      averageTrendScore: trending.length > 0 ? 
        (trending.reduce((sum, p) => sum + p.trendScore, 0) / trending.length).toFixed(2) : "0"
    },
    generatedAt: new Date().toISOString()
  }
}

function generateOverviewRecommendations(
  totalStockValue: number,
  lowStockCount: number, 
  recentProfit: number,
  pendingReceivables: number,
  pendingPayables: number
): string[] {
  const recommendations: string[] = []

  if (lowStockCount > 0) {
    recommendations.push(`⚠️ ${lowStockCount} produto(s) com estoque baixo precisam de atenção`)
  }

  if (recentProfit < 0) {
    recommendations.push("📉 Lucro recente negativo - revisar estratégia de preços e custos")
  }

  if (pendingReceivables > pendingPayables * 2) {
    recommendations.push("💰 Boa posição de recebíveis - focar na cobrança para melhorar fluxo de caixa")
  }

  if (pendingPayables > pendingReceivables * 1.5) {
    recommendations.push("⚠️ Contas a pagar altas - priorizar quitação de débitos")
  }

  if (totalStockValue > 50000) {
    recommendations.push("📊 Estoque de alto valor - considerar estratégias de rotatividade")
  }

  return recommendations
}