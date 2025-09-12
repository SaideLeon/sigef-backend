# SIGEF Backend

Backend para o SIGEF (Sistema de Gestão Financeira), uma aplicação para ajudar pequenos empreendedores a gerenciar produtos, vendas e finanças.

## Features

- **Autenticação de Usuários**: Login nativo (e-mail/senha) e social com Google (OAuth 2.0).
- **Gestão de Produtos**: Operações CRUD completas para o estoque.
- **Gestão de Vendas**: Rastreamento de vendas e perdas.
- **Gestão de Dívidas**: Controle de contas a pagar e a receber.
- **Painel de Administração**: Gerenciamento de usuários e planos de assinatura.
- **Análise Financeira com IA**: Endpoint que utiliza IA generativa para fornecer insights sobre a saúde financeira do negócio.
- **Documentação de API**: Documentação interativa e automática com Swagger (OpenAPI).

## API Documentation

A documentação completa da API é gerada automaticamente e está disponível para exploração e testes.

- **URL**: `/api-docs`

Após iniciar o servidor, acesse [http://localhost:3001/api-docs](http://localhost:3001/api-docs).

## Tech Stack

- **Backend**: Node.js, Express.js
- **Linguagem**: TypeScript
- **ORM**: Prisma
- **Banco de Dados**: PostgreSQL
- **Autenticação**: JSON Web Tokens (JWT), Passport.js
- **Inteligência Artificial**: Genkit (Google AI)
- **Documentação**: Swagger (OpenAPI)

## Getting Started

Siga as instruções abaixo para configurar e rodar o projeto em seu ambiente local.

### Prerequisites

- Node.js (v18 ou superior)
- npm
- PostgreSQL

### Installation

1. **Clone o repositório:**
   ```sh
   https://github.com/SaideLeon/sigef-backend.git
   cd sigef-backend
   ```

2. **Instale as dependências:**
   ```sh
   npm install
   ```

3. **Configure as Variáveis de Ambiente:**
   - Copie o arquivo de exemplo `.env.example` para um novo arquivo chamado `.env`.
   - Preencha as variáveis no arquivo `.env` com suas próprias chaves e URLs (banco de dados, Google OAuth, etc.).

4. **Execute as Migrações do Banco de Dados:**
   O Prisma usará a URL do banco de dados no seu arquivo `.env` para aplicar o schema.
   ```sh
   npx prisma migrate dev
   ```

5. **Gere o Prisma Client:**
   É uma boa prática gerar o client após qualquer mudança no schema.
   ```sh
   npx prisma generate
   ```

### Running the Application

- **Modo de Desenvolvimento:**
  O servidor irá reiniciar automaticamente a cada mudança nos arquivos.
  ```sh
  npm run dev
  ```

- **Modo de Produção:**
  Compile os arquivos TypeScript para JavaScript e inicie o servidor.
  ```sh
  npm run build
  npm run start
  ```

## NPM Scripts

- `npm run dev`: Inicia o servidor em modo de desenvolvimento com `ts-node` e `nodemon`.
- `npm run start`: Inicia o servidor em modo de produção a partir dos arquivos compilados na pasta `dist`.
- `npm run build`: Compila o código TypeScript para JavaScript.
- `npm run prisma:migrate`: Executa as migrações do banco de dados.
- `npm run prisma:generate`: Gera o Prisma Client com base no seu `schema.prisma`.
