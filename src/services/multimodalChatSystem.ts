import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import gemini from '../config/gemini';
import UserRAGManager from './userRAGManager';
import { ChatRequest, ChatResponse } from '../types';

class MultimodalChatSystem {
  private ragManager = new UserRAGManager();
  private config = gemini;

  async processUserMessage(
    userId: string,
    request: ChatRequest
  ): Promise<ChatResponse> {
    try {
      const { textModel, visionModel } = this.config.getModels();

      // Criar ou obter vector store do usuário
      const vectorStore = await this.ragManager.createUserVectorStore(userId);
      const retriever = vectorStore.asRetriever({ k: 5 });

      // Gerenciar contexto da conversa
      const conversationId =
        request.conversationId || this.ragManager.createNewConversation(userId);

      let context = this.ragManager.getConversationContext(conversationId);
      if (!context) {
        context = {
          conversationId,
          userId,
          messages: [],
          lastAccessed: new Date(),
        };
      }

      let imageAnalysis = '';

      // Processar imagem se fornecida
      if (request.imageBase64) {
        const imageMessage = new HumanMessage({
          content: [
            {
              type: 'text',
              text: 'Analise esta imagem e descreva o que você vê, especialmente se relacionado a produtos, vendas ou negócios. Seja específico e detalhado.',
            },
            {
              type: 'image_url',
              image_url: `data:image/jpeg;base64,${request.imageBase64}`,
            },
          ],
        });

        const imageResult = await visionModel.invoke([imageMessage]);
        imageAnalysis = imageResult.content.toString();
      }

      // Criar prompt contextual
      const conversationHistory = context.messages
        .slice(-6) // Últimas 6 mensagens
        .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
        .join('\n');

      const enhancedQuery = imageAnalysis
        ? `${request.message}\n\nAnálise da imagem fornecida: ${imageAnalysis}`
        : request.message;

      // Criar template de prompt
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

Resposta:`;

      const prompt = ChatPromptTemplate.fromTemplate(template);

      // Criar chain RAG
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

      // Executar consulta
      const response = await ragChain.invoke(enhancedQuery);

      // Atualizar contexto da conversa
      context.messages.push({
        role: 'user',
        content: request.message,
        timestamp: new Date(),
        imageAnalysis: imageAnalysis || undefined,
      });

      context.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      this.ragManager.updateConversationContext(context);

      return {
        response,
        conversationId,
        sources: ['Dados do usuário', ...(imageAnalysis ? ['Análise de imagem'] : [])],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Error processing message: ${error}`);
    }
  }
}

export default MultimodalChatSystem;
