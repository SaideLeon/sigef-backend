// src/scripts/init-postgresql.ts
import { pgPool } from '../config/postgresql';

async function initializePostgreSQL() {
  console.log('🚀 Initializing PostgreSQL for SIGEF...');

  try {
    const client = await pgPool.connect();

    // Create vector extension if it doesn't exist
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ Created vector extension');
    } catch (error) {
      console.log('ℹ️ Vector extension may already exist');
    }

    client.release();
    console.log('🎉 PostgreSQL initialization completed!');
  } catch (error) {
    console.error('❌ PostgreSQL initialization failed:', error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initializePostgreSQL();
}

export { initializePostgreSQL };
