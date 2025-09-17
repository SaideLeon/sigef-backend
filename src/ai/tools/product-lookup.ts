import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { User } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector"

export function createProductLookupTool(vectorStore: PGVectorStore, user: User) {
  return tool(
    async ({ query, n = 10 }) => {
      try {
        console.log(`Product lookup for user ${user.email} with query:`, query)

        const result = await vectorStore.similaritySearchWithScore(query, n, {
            userId: user.id
        })
        
        if (result.length === 0) {
          // Fallback to direct Prisma query if no vector search results
          console.log("Vector search returned no results, using direct Prisma query...")
          
          const directProducts = await prisma.product.findMany({
            where: {
              userId: user.id, // Filter by user
              OR: [
                { name: { contains: query, mode: 'insensitive' } }
              ]
            },
            include: {
              sales: {
                take: 5,
                orderBy: { createdAt: 'desc' }
              }
            },
            take: n
          })

          return JSON.stringify({
            results: directProducts,
            searchType: "direct_prisma",
            query: query,
            count: directProducts.length,
            message: "Recuperado do banco Prisma (vector search não retornou resultados)"
          })
        }

        return JSON.stringify({
          results: result,
          searchType: "vector",
          query: query,
          count: result.length
        })
        
      } catch (error: any) {
        console.error("Error in product lookup:", error)
        return JSON.stringify({ 
          error: "Falha na busca de produtos", 
          details: error.message,
          query: query
        })
      }
    },
    {
      name: "product_lookup",
      description: "Busca produtos no estoque usando busca semântica para encontrar produtos, verificar níveis de estoque, analisar performance de vendas e recuperar informações de produtos",
      schema: z.object({
        query: z.string().describe("A consulta de busca para encontrar produtos"),
        n: z.number().optional().default(10).describe("Número de resultados para retornar"),
      }),
    }
  )
}
