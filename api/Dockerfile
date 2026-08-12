# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Headless Chromium for Puppeteer (resume PDF rendering). puppeteer-core ships
# no browser, so install the system package and point Puppeteer at it. The
# bundled Chromium wouldn't run on Alpine (musl) anyway.
RUN apk add --no-cache \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    RESUME_STORAGE_DIR=/app/storage/resumes

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Storage dir for generated PDFs, owned by the runtime user so a freshly
# mounted named volume inherits writable ownership.
RUN mkdir -p /app/storage/resumes && chown -R nestjs:nodejs /app/storage

USER nestjs
EXPOSE 4001
ENV PORT=4001

CMD ["node", "dist/main.js"]
