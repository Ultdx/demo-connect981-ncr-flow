FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN npm ci
COPY . .
RUN npm run codegen && npm run build --workspace @ncr-flow/api
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
