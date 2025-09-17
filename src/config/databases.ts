// src/config/databases.ts
export const DATABASES = {
    // Para embeddings e vector search
    EMBEDDINGS: {
      name: "sigef_inventory_database",
      collections: {
        PRODUCTS: "products",
        CONVERSATIONS: "conversations"
      },
      indexes: {
        PRODUCTS: "products_index"
      }
    },
    
    // Para dados do WhatsApp (existente)
    WHATSAPP: {
      name: "whatsapp_sessions",
      collections: {
        SESSIONS: "sessions",
        MESSAGES: "messages"
      }
    }
  } as const;