# 1. Usar imagen oficial de Node (Cambiado a 22 para consistencia)
FROM node:22-alpine

# REQUERIDO: Instalar openssl para que Prisma funcione en Alpine
RUN apk add --no-cache openssl

# 2. Directorio de trabajo
WORKDIR /app

# 3. Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# 4. Instalar dependencias
RUN npm install

# 5. Generar Cliente de Prisma
RUN npx prisma generate

# 6. Copiar el resto del código
COPY . .

# 7. Puerto del backend
EXPOSE 3000

# 8. Comando para arrancar
CMD ["npm", "run", "dev"]