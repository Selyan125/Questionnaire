FROM node:20-alpine

RUN apk add --no-cache bash openssl

WORKDIR /app

COPY . .

RUN npm install

RUN npx prisma generate --schema=./schema.prisma

ENV NODE_ENV=production

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]