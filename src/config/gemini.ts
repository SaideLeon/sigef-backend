import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

class GeminiRAGConfig {
  private static instance: GeminiRAGConfig;
  private apiKey: string;
  private modelId: string;
  private genAI: GoogleGenerativeAI;
  private textModel: ChatGoogleGenerativeAI;
  private visionModel: ChatGoogleGenerativeAI;
  private embeddings: GoogleGenerativeAIEmbeddings;

  private constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelId = process.env.GEMINI_MODEL_ID || '';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    if (!this.apiKey.startsWith('AIz')) {
      throw new Error('GEMINI_API_KEY must start with "AIz"');
    }
    if(!this.modelId) {
      throw new Error('GEMINI_MODEL_ID not found in environment variables');
    } 
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    
    this.textModel = new ChatGoogleGenerativeAI({
      model: this.modelId,
      temperature: 0.7,
      maxOutputTokens: 1024,
      apiKey: this.apiKey
    });

    this.visionModel = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.7,
      maxOutputTokens: 1024,
      apiKey: this.apiKey
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: this.apiKey
    });
  }

  public static getInstance(): GeminiRAGConfig {
    if (!GeminiRAGConfig.instance) {
      GeminiRAGConfig.instance = new GeminiRAGConfig();
    }
    return GeminiRAGConfig.instance;
  }

  public getModels() {
    return {
      textModel: this.textModel,
      visionModel: this.visionModel,
      embeddings: this.embeddings
    };
  }
}

export default GeminiRAGConfig.getInstance();
