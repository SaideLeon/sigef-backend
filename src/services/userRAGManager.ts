import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { prisma } from '../lib/prisma';
import gemini from '../config/gemini';
import { UserData, ConversationContext } from '../types';

class UserRAGManager {
  private userVectorStores: Map<string, FaissStore> = new Map();
  private conversationContexts: Map<string, ConversationContext> = new Map();

  async getUserData(userId: string): Promise<UserData> {
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
      throw new Error('User not found');
    }

    return {
      id: user.id,
      products: user.products,
      sales: user.sales,
      debts: user.debts,
    };
  }

  async createUserVectorStore(userId: string): Promise<FaissStore> {
    try {
      // Verificar se já existe
      if (this.userVectorStores.has(userId)) {
        return this.userVectorStores.get(userId)!;
      }

      const userData = await this.getUserData(userId);
      const documents = await this.createDocumentsFromUserData(userData);

      const { embeddings } = gemini.getModels();
      const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

      this.userVectorStores.set(userId, vectorStore);
      return vectorStore;
    } catch (error) {
      throw new Error(`Error creating user vector store: ${error}`);
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
    // Remover store existente e recriar
    this.userVectorStores.delete(userId);
    await this.createUserVectorStore(userId);
  }

  getConversationContext(conversationId: string): ConversationContext | null {
    return this.conversationContexts.get(conversationId) || null;
  }

  updateConversationContext(context: ConversationContext): void {
    context.lastAccessed = new Date();
    this.conversationContexts.set(context.conversationId, context);
  }

  createNewConversation(userId: string): string {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: ConversationContext = {
      conversationId,
      userId,
      messages: [],
      lastAccessed: new Date(),
    };
    this.conversationContexts.set(conversationId, context);
    return conversationId;
  }
}

export default UserRAGManager;
