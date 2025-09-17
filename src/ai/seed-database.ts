import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoClient } from "mongodb"
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import { PrismaClient } from "@prisma/client"
import "dotenv/config"

const prisma = new PrismaClient()
const mongoClient = new MongoClient(process.env.MONGODB_ATLAS_URI as string)

// Função para popular o banco para um usuário específico
export async function seedUserProducts(userId?: string): Promise<void> {
  try {
    await mongoClient.connect()
    
    const db = mongoClient.db("sigef_inventory_database")
    const collection = db.collection("products")
    
    // Se userId específico for fornecido, limpa apenas os dados desse usuário
    if (userId) {
      await collection.deleteMany({ userId })
      console.log(`Cleared existing embeddings for user: ${userId}`)
    } else {
      await collection.deleteMany({})
      console.log("Cleared all existing embeddings")
    }
    
    // Busca produtos do usuário específico ou todos
    const whereClause = userId ? { userId } : {}
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        sales: { include: { debts: true } },
        user: { select: { name: true, email: true } }
      }
    })

    if (products.length === 0) {
      console.log("No products found to seed")
      return
    }

    console.log(`Processing ${products.length} products for embedding...`)
    
    for (const product of products) {
      try {
        const enrichedData = {
          productId: product.id,
          userId: product.userId,
          name: product.name,
          acquisitionValue: product.acquisitionValue,
          quantity: product.quantity,
          // ... resto dos dados do produto
        }
        
        const summary = await createProductSummary(enrichedData)
        
        const document = {
          pageContent: summary,
          metadata: {
            ...enrichedData,
            type: 'product',
            lastUpdated: new Date().toISOString()
          }
        }
        
        await MongoDBAtlasVectorSearch.fromDocuments(
          [document],
          new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_API_KEY,
            modelName: "text-embedding-004"
          }),
          {
            collection,
            indexName: "sigef_product_vector_index",
            textKey: "embedding_text",
            embeddingKey: "embedding"
          }
        )
        
        console.log(`✅ Processed: ${product.name} for user ${product.userId}`)
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ Failed to process product ${product.name}:`, error)
      }
    }
    
    console.log("🎉 Seeding completed successfully!")
    
  } catch (error) {
    console.error("❌ Error seeding database:", error)
  } finally {
    await prisma.$disconnect()
    await mongoClient.close()
  }
}

// Função helper para criar sumário do produto
async function createProductSummary(product: any): Promise<string> {
  // ... implementação similar ao código original
  return `Product: ${product.name} (ID: ${product.productId})...`
}

// Executar se for chamado diretamente
if (require.main === module) {
  const userId = process.argv[2] // Permite especificar usuário: npm run seed userId
  seedUserProducts(userId).catch(console.error)
}