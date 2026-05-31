FROM node:20-alpine

# Installer git et openssh-client pour pouvoir cloner des repos privés si nécessaire
RUN apk add --no-cache git openssh-client bash

WORKDIR /usr/src/app

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# Installer les dépendances
RUN npm install

# Exposer le port
EXPOSE 3000

# Variable d'environnement pour la production
ENV NODE_ENV=production

# Lancer l'application en mode production
#CMD [ "node", ".output/server/index.mjs" ]]
#CMD [ "npm", "start" ]
CMD ["node", "server.js"]
