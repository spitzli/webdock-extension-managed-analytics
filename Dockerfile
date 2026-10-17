FROM oven/bun@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY vendor ./vendor
RUN bun install --production --frozen-lockfile --ignore-scripts
FROM oven/bun@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
LABEL org.opencontainers.image.source="https://github.com/spitzli/webdock-extension-managed-analytics"
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY ui ./ui
ENV NODE_ENV=production
USER bun
EXPOSE 3443 3444
CMD ["bun", "src/index.ts"]
