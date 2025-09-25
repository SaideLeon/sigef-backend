FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Se usar TypeScript, descomente:
RUN npm run build

# Prisma precisa rodar no build
RUN npx prisma generate

CMD ["npm", "run", "start"]
