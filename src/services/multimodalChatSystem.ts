// src/services/multimodalChatSystem.ts
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import gemini from '../config/gemini';
import UserRAGManager from './userRAGManager';
import ConversationManager from './conversationManager';
import { ChatRequest, ChatResponse } from '../types';

class MultimodalChatSystem {
  private ragManager: UserRAGManager;
  private conversationManager: ConversationManager;

  constructor() {
    this.ragManager = new UserRAGManager();
    this.conversationManager = new ConversationManager();
  }

  async handleRequest(
    userId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    console.log(`[MultimodalChatSystem] Processing message for userId: ${userId}`, { request });
    try {
      const { textModel, visionModel } = gemini.getModels();

      const conversationId =
        request.conversationId ||
        this.conversationManager.createNewConversation(userId);

      let context = this.conversationManager.getConversationContext(conversationId);
      if (!context) {
        // This case should ideally not happen if createNewConversation is called correctly
        context = { id: conversationId, userId, messages: [] };
        this.conversationManager.updateConversationContext(context);
      }

      console.log(`[MultimodalChatSystem] Getting vector store for userId: ${userId}`);
      let vectorStore;
      try {
          vectorStore = await this.ragManager.createUserVectorStore(userId);
      } catch (err) {
          console.error("[MultimodalChatSystem] Failed to create or load vector store. RAG will be disabled for this request.", err);
          vectorStore = null;
      }

      if (!vectorStore) {
          throw new Error("Failed to initialize user data for AI analysis due to an external service error. Please try again later.");
      }

      const retriever = vectorStore.asRetriever({ k: 45 });
      console.log(`[MultimodalChatSystem] Retriever initialized for userId: ${userId}`);

      let imageAnalysis = '';
      if (request.imageBase64) {
        console.log(`[MultimodalChatSystem] Image provided, performing analysis.`);
        const imageMessage = new HumanMessage({
          content: [
            { type: 'text', text: 'Analise esta imagem...' },
            { type: 'image_url', image_url: `data:image/jpeg;base64,${request.imageBase64}` },
          ],
        });
        const imageResult = await visionModel.invoke([imageMessage]);
        imageAnalysis = imageResult.content.toString();
        console.log(`[MultimodalChatSystem] Image analysis result:`, imageAnalysis);
      }

      this.conversationManager.addMessage(conversationId, "user", request.message);

      const conversationHistory = context.messages
        .slice(-6)
        .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
        .join('\n');
      console.log(`[MultimodalChatSystem] Conversation history for prompt:`, conversationHistory);

      const enhancedQuery = imageAnalysis
        ? `${request.message}\n\nAnálise da imagem fornecida: ${imageAnalysis}`
        : request.message;

      const template = `
Você é um assistente especializado em ajudar com gestão de negócios, produtos, vendas e finanças.

Contexto da conversa anterior:
{conversation_history}

Informações relevantes dos dados do usuário:
{context}

Pergunta atual: {query}

${imageAnalysis ? `Análise da imagem: ${imageAnalysis}` : ''}

Instruções:
1. Responda de forma clara e objetiva
2. Use os dados específicos do usuário quando relevante
3. Se a pergunta for sobre produtos, vendas ou dívidas, cite informações específicas
4. Se não houver dados relevantes, explique isso ao usuário
5. Seja prestativo e profissional
6. Use valores em reais (MZN) quando aplicável

Resposta:
`;

      const prompt = ChatPromptTemplate.fromTemplate(template);

      const ragChain = RunnableSequence.from([
        {
          context: retriever,
          query: new RunnablePassthrough(),
          conversation_history: () => conversationHistory,
        },
        prompt,
        textModel,
        new StringOutputParser(),
      ]);

      console.log(`[MultimodalChatSystem] Invoking RAG chain with query: "${enhancedQuery}"`);
      const response = await ragChain.invoke(enhancedQuery);
      console.log(`[MultimodalChatSystem] RAG chain response:`, response);

      this.conversationManager.addMessage(conversationId, "assistant", response);

      const chatResponse: ChatResponse = {
        response,
        conversationId,
        sources: ['Dados do usuário', ...(imageAnalysis ? ['Análise de imagem'] : [])],
        timestamp: new Date().toISOString(),
      };
      console.log(`[MultimodalChatSystem] Final response object:`, chatResponse);
      return chatResponse;
    } catch (error: any) {
      console.error(`[MultimodalChatSystem] Error processing message for userId: ${userId}`, error);
      throw new Error(`Error processing message: ${error.message}`);
    }
  }
}

export default MultimodalChatSystem;