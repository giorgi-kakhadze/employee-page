# Pass to the Floor · Gunda · Server Edition
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-slim
ENV NODE_ENV=production PTF_ENV=production PORT=8080
WORKDIR /app
RUN groupadd -r ptf && useradd -r -g ptf -d /app -s /usr/sbin/nologin ptf && mkdir -p /app/data && chown ptf:ptf /app/data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
USER ptf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--max-old-space-size=1536", "src/server.js"]
