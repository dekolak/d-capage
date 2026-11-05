# Image unique : API + app mobile compilée.
FROM node:22-slim AS build
WORKDIR /src
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/machine-kit/package.json packages/machine-kit/
COPY apps/api/package.json apps/api/
COPY apps/app/package.json apps/app/
RUN npm ci
COPY . .
RUN npm run build --workspace packages/machine-kit \
 && npx --workspace apps/api prisma generate \
 && npm run build --workspace apps/api \
 && npm run build --workspace apps/app

FROM node:22-slim
WORKDIR /srv
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /src /srv
WORKDIR /srv/apps/api
EXPOSE 3000
# Migrations + catalogue à chaque démarrage (idempotent), puis l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && node dist/main"]
