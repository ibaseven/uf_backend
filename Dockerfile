FROM node:18-alpine
WORKDIR /app

# Copier package.json et installer les dépendances en production
COPY package*.json ./
RUN npm install --production

# Copier le reste du code source
COPY . .

# Exposer le port sur lequel ton serveur écoute
EXPOSE 5000

# Commande de lancement
CMD ["node", "server.js"]