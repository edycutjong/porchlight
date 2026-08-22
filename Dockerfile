# Porchlight — the live demo app.
# A persistent Node process, deliberately not a serverless function: a real Mind
# judgement takes tens of seconds, which exceeds common function ceilings, and the
# per-visitor demo state lives in memory for the length of a session.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Deps first so image layers cache across code edits. tsx runs the TS directly, so
# devDependencies are needed at runtime here — no build step, no dist/.
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY tsconfig.json ./

# MINDS_BUILDER_API_KEY and MIND_ID are injected as Fly secrets at runtime.
# They are never baked into this image and never committed.
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "src/server.ts"]
