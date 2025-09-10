FROM node:alpine AS builder

# 允许在构建阶段注入 Vite 环境变量，指向本地后端
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

# 复制源代码，但排除 node_modules
COPY . .
# 删除可能存在的 node_modules 目录，重新安装
RUN rm -rf node_modules && pnpm install

RUN pnpm build

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 
