FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm config set fetch-retries 5 fetch-retry-mintimeout 20000 fetch-retry-maxtimeout 120000 \
    && for i in 1 2 3 4 5; do npm ci && break; \
    [ "$i" = 5 ] && exit 1; echo "npm ci retry $i"; sleep 10; done
COPY prisma ./prisma
RUN for i in 1 2 3 4 5; do npx prisma generate && break; \
    [ "$i" = 5 ] && exit 1; echo "prisma generate retry $i"; sleep 8; done

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm config set fetch-retries 5 fetch-retry-mintimeout 20000 fetch-retry-maxtimeout 120000 \
    && for i in 1 2 3 4 5; do npm ci --omit=dev && npm install tsx --no-save && npm cache clean --force && break; \
    [ "$i" = 5 ] && exit 1; echo "npm ci (runner) retry $i"; sleep 10; done
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && mkdir -p uploads
EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
