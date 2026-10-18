FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
ENV MONGOMS_DISABLE_POSTINSTALL=1
# Empty API URL keeps the standalone image on its own nginx proxy by default.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN npm ci
COPY . .
# The standalone nginx image serves the demo at / rather than the hosted subpath.
RUN npm run codegen && npm run build --workspace @ncr-flow/web -- --base=/

FROM nginx:stable-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
