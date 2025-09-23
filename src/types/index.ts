export interface ChatRequest {
  message: string;
  imageBase64?: string;
  conversationId?: string;
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  sources: string[];
  timestamp: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface UserData {
  id: string;
  products: Array<{
    id: string;
    name: string;
    acquisitionValue: number;
    quantity: number;
    initialQuantity: number | null;
    createdAt: Date;
  }>;
  sales: Array<{
    id: string;
    productName: string;
    quantitySold: number;
    saleValue: number;
    profit: number;
    isLoss: boolean;
    lossReason: string | null;
    createdAt: Date;
  }>;
  debts: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    amountPaid: number;
    status: string;
    contactName: string | null;
    dueDate: Date | null;
    createdAt: Date;
  }>;
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    imageAnalysis?: string;
  }>;
  lastAccessed: Date;
}
