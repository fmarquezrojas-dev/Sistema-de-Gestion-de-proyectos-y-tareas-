# 1. Usar Node 22 para evitar el error de "esbuild" que da la versión 18 en Vite
FROM node:22-alpine

WORKDIR /app

# 2. Copiar solo lo necesario para instalar dependencias (optimiza el cache)
COPY package*.json ./
RUN npm install

# 3. Copiar el resto del código del frontend
COPY . .

# 4. Puerto por defecto de Vite
EXPOSE 5173

# 5. El flag --host es fundamental para que Docker mapee el puerto al localhost de Windows
CMD ["npm", "run", "dev", "--", "--host"]