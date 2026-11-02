# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# copy package files
COPY package*.json ./

RUN npm install --legacy-peer-deps

# build-time env variables (NEXT_PUBLIC_* are inlined during build)
ARG NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# copy source code
COPY . .

# build Next.js app
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed for standalone production server
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# standalone server replaces `next start`
CMD ["node", "server.js"]
