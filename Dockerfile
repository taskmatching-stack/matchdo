# 明確複製 public/ 等檔案，避免 Buildpacks 漏打導致首頁 File not found
FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
