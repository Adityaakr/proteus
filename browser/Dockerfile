# The importer's browser service: headless Chromium behind a token, with no application secrets.
# Build context is the repository root (it reuses the API's egress proxy and address checks).
FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g tsx@4.23.15
WORKDIR /app
COPY server/src/lib/net-guard.ts server/src/lib/net-guard.ts
COPY server/src/services/importer/egress-proxy.ts server/src/services/importer/egress-proxy.ts
COPY browser/service.ts browser/main.ts browser/
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["tsx", "browser/main.ts"]
