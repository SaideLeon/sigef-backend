import { prisma } from '../lib/prisma';

class ChatUtils {
  static async cleanupOldConversations(): Promise<void> {
    // Implementar limpeza de conversas antigas (> 24h)
    // const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // await prisma.conversation.deleteMany({
    //   where: {
    //     updatedAt: {
    //       lt: cutoff,
    //     },
    //   },
    // });
    console.log("cleanupOldConversations not implemented yet, requires Conversation model in schema");
  }

  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  static validateImageBase64(base64: string): boolean {
    try {
      const buffer = Buffer.from(base64, 'base64');
      return buffer.length > 0 && buffer.length < 10 * 1024 * 1024; // Max 10MB
    } catch {
      return false;
    }
  }
}

export default ChatUtils;
