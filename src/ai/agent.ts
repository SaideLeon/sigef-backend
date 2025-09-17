// src/ai/agent.ts

import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { User } from "@prisma/client";
import { pgPool } from "../config/postgresql";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";

import { createProductLookupTool } from "./tools/product-lookup";
import { createProductDetailsTool } from "./tools/product-details";
import { createInventoryAnalyticsTool } from "./tools/inventory-analytics";

// Utility function para retry com backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`Rate limit hit. Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// Função principal do agent integrada com autenticação SIGEF
export async function callSIGEFAgent(
  query: string,
  threadId: string,
  user: User
) {
  try {
    const vectorStore = await PGVectorStore.initialize(
      new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_GENAI_API_KEY,
        modelName: "text-embedding-004"
      }),
      {
        client: pgPool,
        tableName: "product_embeddings",
      }
    );

    // Define o estado do workflow
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
    });

    // Cria as tools com contexto do usuário
    const productLookupTool = createProductLookupTool(vectorStore, user);
    const getProductDetailsTool = createProductDetailsTool(user);
    const inventoryAnalyticsTool = createInventoryAnalyticsTool(user);

    const tools = [productLookupTool, getProductDetailsTool, inventoryAnalyticsTool];
    const toolNode = new ToolNode<typeof GraphState.State>(tools);

    // Modelo AI com configuração específica para SIGEF
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0,
      maxRetries: 0,
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }).bindTools(tools);

    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      return lastMessage.tool_calls?.length ? "tools" : "__end__";
    }

    async function callModel(state: typeof GraphState.State) {
      return retryWithBackoff(async () => {
        const prompt = ChatPromptTemplate.fromMessages([
          [
            "system",
            `Você é o Assistente SIGEF, um assistente inteligente de gestão de estoque para o sistema SIGEF.\n\nIMPORTANTE: Você está conversando com ${user.name} (${user.email}).\n\nSuas capacidades incluem:\n- Busca e consulta de produtos usando busca semântica\n- Análise detalhada de produtos incluindo histórico de vendas\n- Geração de relatórios e análises de negócio\n- Alertas de estoque baixo\n- Análise de performance de vendas\n- Rastreamento de dívidas relacionadas a vendas\n\nMoeda: Todas as valores monetários são em MZN (Metical Moçambicano)\n\nSempre use as ferramentas apropriadas para fornecer informações precisas e em tempo real.\nSeja profissional, útil e direto nas suas respostas.\n\nHora atual: {time}`,
          ],
          new MessagesPlaceholder("messages"),
        ]);

        const formattedPrompt = await prompt.formatMessages({
          time: new Date().toISOString(),
          messages: state.messages,
        });

        const result = await model.invoke(formattedPrompt);
        return { messages: [result] };
      });
    }

    // Constrói o workflow
    const workflow = new StateGraph(GraphState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");

    // Estado da conversa com contexto do usuário
    const checkpointer = new PostgresSaver({
        client: pgPool,
    });

    const app = workflow.compile({ checkpointer });

    // Executa o workflow
    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(query)],
      },
      {
        recursionLimit: 15,
        configurable: { thread_id: `${user.id}_${threadId}` }, // Thread isolada por usuário
      }
    );

    const response = finalState.messages[finalState.messages.length - 1].content;
    console.log(`Agent response for user ${user.email}:`, response);

    return response;
  } catch (error: any) {
    console.error("Error in SIGEF Agent:", error.message);

    if (error.status === 429) {
      throw new Error(
        "Serviço temporariamente indisponível devido a limites de taxa. Tente novamente em um minuto."
      );
    } else if (error.status === 401) {
      throw new Error("Falha na autenticação. Verifique sua configuração da API.");
    } else {
      throw new Error(`Assistente SIGEF falhou: ${error.message}`);
    }
  }
}