# Usa una imagen oficial de Node.js (por ejemplo, la versión 18 con Alpine)
FROM node:18-alpine

# Actualiza el índice de paquetes e instala nano
RUN apk update && apk add nano


# Establece el directorio de trabajo en la imagen
WORKDIR /app

# Copia el package.json y package-lock.json (si existe)
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Expone el puerto en el que corre tu API (por ejemplo, el 3000)
EXPOSE 3555

# Comando para iniciar la aplicación
CMD ["node", "index.js"]