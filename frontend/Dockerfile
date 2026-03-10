FROM node:20-alpine AS builder
WORKDIR /app

# Accept build-time env vars (required for Next.js static analysis at build time)
# Build-time env vars — defaults let local builds work without explicit --build-arg.
# .env.local (copied below) also provides these; ARG defaults are fallbacks for CI.
ARG NEXT_PUBLIC_SUPABASE_URL=placeholder_url
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder_key
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ARG NEXT_PUBLIC_SITE_URL=http://localhost:2323

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
