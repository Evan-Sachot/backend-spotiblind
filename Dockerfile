
# ---------- ÉTAPE 1 : construction ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------- ÉTAPE 2 : image finale ----------
FROM node:22-alpine AS production

WORKDIR /app


COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist


USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
