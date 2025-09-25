FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copia o resto do código
COPY . .

# Copia o .env
COPY .env ./

RUN npx prisma generate
RUN npm run build

EXPOSE 3080

CMD ["npm", "run", "start"]
