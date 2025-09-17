import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import { Collection } from "mongodb"
import { User } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export function createProductLookupTool(collection: Collection, user: User) {
  return tool(
    async ({ query, n = 10 }) => {
      try {
        console.log(`Product lookup for user ${user.email} with query:`, query)

        // Verifica se há dados no vector database
        const totalCount = await collection.countDocuments({ userId: user.id })
        
        if (totalCount === 0) {
          console.log("Vector collection empty, using direct Prisma query...")
          
          const directProducts = await prisma.product.findMany({
            where: {
              userId: user.id, // Filtra por usuário
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
            message: "Recuperado do banco Prisma (vector database não populado)"
          })
        }

        // Configuração do vector search
        const dbConfig = {
          collection: collection,
          indexName: "sigef_product_vector_index",
          textKey: "embedding_text",
          embeddingKey: "embedding",
          filter: { userId: user.id } // Filtra por usuário no vector search
        }

        const vectorStore = new MongoDBAtlasVectorSearch(
          new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY,
            model: "text-embedding-004",
          }),
          dbConfig
        )

        const result = await vectorStore.similaritySearchWithScore(query, n)
        
        if (result.length === 0) {
          // Fallback para busca textual com filtro de usuário
          const textResults = await collection.find({
            userId: user.id,
            $or: [
              { "metadata.name": { $regex: query, $options: 'i' } },
              { "embedding_text": { $regex: query, $options: 'i' } }
            ]
          }).limit(n).toArray()
          
          return JSON.stringify({
            results: textResults,
            searchType: "mongodb_text",
            query: query,
            count: textResults.length
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