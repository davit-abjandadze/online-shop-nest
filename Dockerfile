# --- Build stage -----------------------------------------------------------
# node:22-slim (debian-based) აქ იმიტომაა და არა alpine, რომ bcrypt-ის native
# addon-ის კომპილაცია პრობლემა არ გახდეს (musl-ზე ხშირად prebuild ვერ პოულობს).
FROM node:22-slim AS builder
WORKDIR /app

# bcrypt-ის native module-ის ასაშენებლად საჭირო ხელსაწყოები
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# ---- production-only node_modules (dev დამოკიდებულებების გარეშე) ----
RUN rm -rf node_modules \
    && yarn install --frozen-lockfile --production \
    && yarn cache clean

# --- Runtime stage -----------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 4000

# პირდაპირ node dist/main — yarn start/start:prod-ს ავუვლით განზრახ, რომ
# package.json-ის "prestart" hook-მა (graphify wiki-ის განახლება) კონტეინერში არ იმუშაოს.
CMD ["node", "dist/main"]
