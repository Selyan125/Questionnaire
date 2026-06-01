FROM node:20-alpine

RUN apk add --no-cache bash openssl

WORKDIR /app

# copier seulement le backend (contexte = server)
COPY . .

RUN npm install

RUN npx prisma generate --schema=./schema.prisma

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]