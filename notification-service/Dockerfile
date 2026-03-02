FROM node:22-alpine

# Mantenemos esto por seguridad para dependencias nativas
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

# COPIA DIRECTA (Sin la línea de prisma)
COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]