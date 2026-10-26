FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

# 在构建镜像时直接生成好 Prisma Client 代码
RUN npx prisma generate

RUN npm run build

# 启动时自动同步表结构到 PostgreSQL，然后启动服务
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx react-router-serve ./build/server/index.js"]