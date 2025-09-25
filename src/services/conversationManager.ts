// src/services/conversationManager.ts
import { randomUUID } from "crypto";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationContext {
  id: string;
  userId: string;
  messages: Message[];
}

export default class ConversationManager {
  private conversations: Map<string, ConversationContext> = new Map();

  createNewConversation(userId: string): string {
    const conversationId = `conv_${Date.now()}_${randomUUID().slice(0, 8)}`;
    this.conversations.set(conversationId, {
      id: conversationId,
      userId,
      messages: [],
    });
    return conversationId;
  }

  getConversationContext(conversationId: string): ConversationContext {
    return (
      this.conversations.get(conversationId) || {
        id: conversationId,
        userId: "",
        messages: [],
      }
    );
  }

  updateConversationContext(context: ConversationContext): void {
    this.conversations.set(context.id, context);
  }

  addMessage(conversationId: string, role: "user" | "assistant", content: string): void {
    const ctx = this.getConversationContext(conversationId);
    ctx.messages.push({ role, content });
    this.updateConversationContext(ctx);
  }
}
