import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { prisma } from '../lib/prisma';
import gemini from '../config/gemini';
import { UserData } from '../types';

class UserRAGManager {
  private userVectorStores: Map<string, MemoryVectorStore> = new Map();

  async getUserData(userId: string): Promise<UserData> {
    console.log(`[UserRAGManager] Getting user data for userId: ${userId}`);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        products: {
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 100, // Limitar para performance
        },
        debts: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!user) {
      console.error(`[UserRAGManager] User not found for userId: ${userId}`);
      throw new Error('User not found');
    }

    console.log(`[UserRAGManager] Retrieved data for userId: ${userId}`, { products: user.products.length, sales: user.sales.length, debts: user.debts.length });
    return {
      id: user.id,
      products: user.products,
      sales: user.sales,
      debts: user.debts,
    };
  }

  async createUserVectorStore(userId: string): Promise<MemoryVectorStore> {
    // 1. Check in-memory cache
    if (this.userVectorStores.has(userId)) {
      console.log(`[UserRAGManager] Returning in-memory cached vector store for userId: ${userId}`);
      return this.userVectorStores.get(userId)!;
    }

    const { embeddings } = gemini.getModels();

    // 2. If no cache, create a new one
    try {
      console.log(`[UserRAGManager] Creating new vector store for userId: ${userId}`);
      const userData = await this.getUserData(userId);
      const documents = await this.createDocumentsFromUserData(userData);
      console.log(`[UserRAGManager] Created ${documents.length} documents for userId: ${userId}`);

      if (documents.length === 0) {
        // Create an empty store if no documents, to avoid re-creating it every time
        console.log(`[UserRAGManager] No documents for userId: ${userId}. Creating empty vector store.`);
        const vectorStore = await MemoryVectorStore.fromDocuments([], embeddings);
        this.userVectorStores.set(userId, vectorStore);
        return vectorStore;
      }

      const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);

      this.userVectorStores.set(userId, vectorStore);
      console.log(`[UserRAGManager] In-memory cached new vector store for userId: ${userId}`);

      return vectorStore;
    } catch (error) {
      console.error(`[UserRAGManager] CRITICAL: Error creating user vector store for userId: ${userId}`, error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }

  private async createDocumentsFromUserData(userData: UserData): Promise<Document[]> {
    const documents: Document[] = [];
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Criar documentos dos produtos
    for (const product of userData.products) {
      const productText = `
        Produto: ${product.name}
        ID: ${product.id}
        Valor de Aquisição: R$ ${product.acquisitionValue}
        Quantidade em Estoque: ${product.quantity}
        Quantidade Inicial: ${product.initialQuantity || 'Não informado'}
        Data de Criação: ${product.createdAt.toLocaleDateString('pt-BR')}
        
        Este produto foi registrado no sistema e possui ${product.quantity} unidades disponíveis.
      `;

      const chunks = await textSplitter.splitText(productText);
      chunks.forEach((chunk: string) => {
        documents.push(new Document({
          pageContent: chunk,
          metadata: {
            type: 'product',
            productId: product.id,
            productName: product.name,
            userId: userData.id,
          },
        }));
      });
    }

    // Criar documentos das vendas
    for (const sale of userData.sales) {
      const saleText = `
        Venda: ${sale.productName}
        ID: ${sale.id}
        Quantidade Vendida: ${sale.quantitySold}
        Valor da Venda: R$ ${sale.saleValue}
        Lucro: R$ ${sale.profit}
        ${sale.isLoss ? `Prejuízo: Sim - Motivo: ${sale.lossReason || 'Não informado'}` : 'Prejuízo: Não'}
        Data da Venda: ${sale.createdAt.toLocaleDateString('pt-BR')}
      `;

      const chunks = await textSplitter.splitText(saleText);
      chunks.forEach((chunk: string) => {
        documents.push(new Document({
          pageContent: chunk,
          metadata: {
            type: 'sale',
            saleId: sale.id,
            productName: sale.productName,
            userId: userData.id,
          },
        }));
      });
    }

    // Criar documentos das dívidas
    for (const debt of userData.debts) {
      const debtText = `
        Dívida: ${debt.description}
        ID: ${debt.id}
        Tipo: ${debt.type === 'receivable' ? 'A Receber' : 'A Pagar'}
        Valor Total: R$ ${debt.amount}
        Valor Pago: R$ ${debt.amountPaid}
        Status: ${debt.status}
        ${debt.contactName ? `Contato: ${debt.contactName}` : ''}
        ${debt.dueDate ? `Data de Vencimento: ${debt.dueDate.toLocaleDateString('pt-BR')}` : ''}
        Data de Criação: ${debt.createdAt.toLocaleDateString('pt-BR')}
      `;

      const chunks = await textSplitter.splitText(debtText);
      chunks.forEach((chunk: string) => {
        documents.push(new Document({
          pageContent: chunk,
          metadata: {
            type: 'debt',
            debtId: debt.id,
            debtType: debt.type,
            userId: userData.id,
          },
        }));
      });
    }

    return documents;
  }

  async refreshUserVectorStore(userId: string): Promise<void> {
    console.log(`[UserRAGManager] Refreshing vector store for userId: ${userId}`);
    this.userVectorStores.delete(userId);
    await this.createUserVectorStore(userId);
    console.log(`[UserRAGManager] Successfully refreshed vector store for userId: ${userId}`);
  }
}

export default UserRAGManager;
