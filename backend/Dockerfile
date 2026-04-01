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

CMD npx prisma migrate resolve --applied 20260328121735_init --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate resolve --applied 20260328123847_enhance_scheduling --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate resolve --applied 20260328135732_add_user_scoping --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate resolve --applied 20260328150000_add_restaurant_share_token --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate resolve --applied 20260328160000_add_restaurant_details --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate resolve --applied 20260328200000_add_user_scoping --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate resolve --applied 20260329000000_add_break_minutes_and_employee_order --schema=prisma/schema.prisma 2>/dev/null; \
    npx prisma migrate deploy --schema=prisma/schema.prisma && \
    node prisma/seed.js && \
    node dist/index.js
