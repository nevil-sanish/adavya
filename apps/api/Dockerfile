# Trusted game API for Cloud Run (or any container host).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Cloud Run sets PORT. Credentials come from the service's identity (ADC); no key file in the image.
USER node
CMD ["node", "dist/index.js"]
