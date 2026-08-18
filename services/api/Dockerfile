FROM node:24.17.0-bookworm-slim AS build

WORKDIR /workspace
COPY . .
RUN npm ci --ignore-scripts \
    && npm run build --workspace @bloodledger/capture-pwa \
    && npm run build --workspace @bloodledger/api \
    && npm prune --omit=dev

FROM node:24.17.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/services/api/package.json ./services/api/package.json
COPY --from=build /workspace/services/api/build ./services/api/build
COPY --from=build /workspace/apps/capture-pwa/dist ./apps/capture-pwa/dist

USER node
EXPOSE 3000
CMD ["node", "services/api/build/src/server.js"]
