import "dotenv/config";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TaskType } from "@google/generative-ai";
import { RunnableSequence } from "@langchain/core/runnables";

// 1. Configurar embeddings (para indexar documentos e consultas)
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
  taskType: TaskType.RETRIEVAL_DOCUMENT,
});

// 2. Criar alguns documentos
const docs = [
  { pageContent: "A maçã é uma fruta vermelha e doce.", metadata: { id: 1 } },
  { pageContent: "O abacaxi é uma fruta tropical com coroa verde.", metadata: { id: 2 } },
  { pageContent: "O limão é uma fruta cítrica, geralmente amarela ou verde.", metadata: { id: 3 } },
];

// 3. Criar um vetor store em memória
const vectorstore = await MemoryVectorStore.fromDocuments(docs, embeddings);

// 4. Transformar em um retriever (para buscar docs relevantes)
const retriever = vectorstore.asRetriever(2);

// 5. Instanciar o modelo de chat (da Google)
const chat = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash", // pode trocar por outro da família gemini
  temperature: 0,
});

// 6. Pipeline: query → buscar docs → gerar resposta
const ragChain = RunnableSequence.from([
  {
    // Busca docs relacionados à pergunta
    context: async (input: { question: string }) => {
      const results = await retriever.invoke(input.question);
      return results.map(r => r.pageContent).join("\n");
    },
    question: (input: { question: string }) => input.question,
  },
  // Gerar resposta com base no contexto + pergunta
  async ({ context, question }) => {
    const prompt = `Use o contexto abaixo para responder a pergunta. 
Se não souber, apenas diga que não encontrou.
Contexto:
${context}

Pergunta: ${question}`;
    const res = await chat.invoke(prompt);
    return res.content;
  },
]);

// 7. Testar o chat
const pergunta = "Qual fruta tem coroa?";
const resposta = await ragChain.invoke({ question: pergunta });

console.log("Pergunta:", pergunta);
console.log("Resposta:", resposta);