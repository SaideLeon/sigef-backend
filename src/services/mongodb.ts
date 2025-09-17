import { MongoClient } from "mongodb"

class MongoDBService {
  private static instance: MongoDBService
  private client: MongoClient | null = null

  private constructor() {}

  static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService()
    }
    return MongoDBService.instance
  }

  async connect(): Promise<MongoClient> {
    if (!this.client) {
      this.client = new MongoClient(process.env.MONGODB_ATLAS_URI as string)
      await this.client.connect()
      await this.client.db("admin").command({ ping: 1 })
      console.log("MongoDB connected for chat embeddings!")
    }
    return this.client
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }

  getClient(): MongoClient | null {
    return this.client
  }
}

export const mongoService = MongoDBService.getInstance()