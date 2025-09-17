// src/ai/seed-database.ts
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PrismaClient } from "@prisma/client";
import { pgPool } from "../config/postgresql";

const prisma = new PrismaClient();

// Função para popular o banco para um usuário específico
export async function seedUserProducts(userId?: string): Promise<void> {
  try {
    const vectorStore = await PGVectorStore.initialize(
      new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_GENAI_API_KEY,
        modelName: "text-embedding-004"
      }),
      {
        pool: pgPool,
        tableName: "product_embeddings",
      }
    );

    // Limpeza dos dados existentes
    if (userId) {
      // This is a simplified example. In a real-world scenario, you would have a more robust way to delete user-specific documents.
      // For now, we'll clear the entire table for simplicity.
      await pgPool.query('TRUNCATE TABLE "product_embeddings"');
      console.log(`Cleared all existing embeddings`);
    } else {
      await pgPool.query('TRUNCATE TABLE "product_embeddings"');
      console.log("Cleared all existing embeddings");
    }

    // Busca produtos do usuário específico ou todos
    const whereClause = userId ? { userId } : {};
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        sales: { include: { debts: true } },
        user: { select: { name: true, email: true } }
      }
    });

    if (products.length === 0) {
      console.log("No products found to seed");
      return;
    }

    console.log(`Processing ${products.length} products for embedding...`);

    for (const product of products) {
      try {
        const enrichedData = {
          productId: product.id,
          userId: product.userId,
          name: product.name,
          acquisitionValue: product.acquisitionValue,
          quantity: product.quantity,
          // ... resto dos dados do produto
        };

        const summary = await createProductSummary(enrichedData);

        const document = {
          pageContent: summary,
          metadata: {
            ...enrichedData,
            type: "product",
            lastUpdated: new Date().toISOString()
          }
        };

        await vectorStore.addDocuments([document]);

        console.log(`✅ Processed: ${product.name} for user ${product.userId}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to process product ${product.name}:`, error);
      }
    }

    console.log("🎉 Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    await prisma.$disconnect();
    await pgPool.end();
  }
}

// Função helper para criar sumário do produto
async function createProductSummary(product: any): Promise<string> {
  return `Product: ${product.name} (ID: ${product.productId}), quantity: ${product.quantity}, acquisitionValue: ${product.acquisitionValue}`;
}

// Executar se for chamado diretamente
if (require.main === module) {
  const userId = process.argv[2]; // Permite especificar usuário: npm run seed userId
  seedUserProducts(userId).catch(console.error);
}