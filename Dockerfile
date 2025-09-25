# 1️⃣ Imagem leve com Node
FROM node:20-alpine

# 2️⃣ Diretório de trabalho
WORKDIR /app

# 3️⃣ Copia apenas os manifests para aproveitar cache do Docker
COPY package*.json ./

# 4️⃣ Instala todas as dependências (incluindo devDependencies)
RUN npm install

# 5️⃣ Copia todo o código para dentro do container
COPY . .

# 6️⃣ Copia o arquivo de ambiente (se necessário)
COPY .env ./

# 7️⃣ Gera o cliente do Prisma
RUN npx prisma generate

# 8️⃣ Compila TypeScript + tsc-alias
RUN npm run build

# 9️⃣ Expõe a porta que a app vai usar
EXPOSE 3031

# 🔟 Comando para iniciar
CMD ["npm", "run", "start"]
