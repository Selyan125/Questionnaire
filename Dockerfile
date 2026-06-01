FROM node:20-alpine

# Dépendances utiles pour Prisma / Node
RUN apk add --no-cache bash openssl

WORKDIR /app

# Copier les dépendances
COPY package*.json ./

# Installer
RUN npm install

# Copier le projet
COPY . .

# Générer Prisma Client
RUN npx prisma generate

# Build (React/Vite ou app Node compilée)
RUN npm run build

# Production
ENV NODE_ENV=production

# Port
EXPOSE 3000

# Lancer l'application
CMD ["npm", "start"]
