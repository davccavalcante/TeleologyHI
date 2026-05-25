FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY maic/  ./maic/
COPY cloud/ ./cloud/
RUN npm ci --workspaces --include-workspace-root --workspaces-update=false \
  --workspace @teleologyhi-sdk/maic \
  --workspace @teleologyhi-sdk/cloud
RUN npm run build --workspace @teleologyhi-sdk/maic
RUN npm run build --workspace @teleologyhi-sdk/cloud

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/cloud/dist/         /app/dist/
COPY --from=build /repo/cloud/package.json  /app/package.json
COPY --from=build /repo/node_modules/       /app/node_modules/
COPY --from=build /repo/maic/               /app/node_modules/@teleologyhi-sdk/maic/
EXPOSE 8787
USER node
CMD ["node", "./dist/cli.js"]
