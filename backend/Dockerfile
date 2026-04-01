FROM node:22-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package.json ./
RUN npm install

# Copy prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy backend source and build
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npx tsc

# Build frontend
WORKDIR /frontend-build
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Move frontend build into backend public folder
RUN mv /frontend-build/dist /app/public

# Cleanup
WORKDIR /app
RUN rm -rf /frontend-build
RUN mkdir -p uploads

EXPOSE 3001

CMD npx prisma migrate deploy --schema=prisma/schema.prisma && \
    node prisma/seed.js && \
    node dist/index.js
