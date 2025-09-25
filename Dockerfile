# Imagem leve com Node
FROM node:20-alpine

# Diretório de trabalho
WORKDIR /app

# Copia apenas os manifests primeiro (cache melhor)
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o resto do código
COPY . .

# Gera o cliente do Prisma
RUN npx prisma generate

# Compila o TypeScript para JS (gera dist/)
RUN npm run build

# Porta que a app vai usar
EXPOSE 3031

# Comando para iniciar (roda dist/index.js ou dist/server.js)
CMD ["npm", "run", "start"]
