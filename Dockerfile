# Utiliser une image Node.js
FROM node:18-alpine

# Installer les dépendances système nécessaires pour canvas
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Copier package.json et installer les dépendances
COPY package*.json ./
RUN npm install --production

# Copier le reste du code source
COPY . .

# Exposer le port de l'application
EXPOSE 5000

# Démarrer l'application
CMD ["npm", "start"]