# ==============================================================
# Global HL7 FHIR Learning Lab — Multi-Stage Production Image
# Stage 1: Build static assets using Bun
# Stage 2: Serve via ultra-lightweight Nginx Alpine
# ==============================================================

# --- Stage 1: Builder ---
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy dependency specifications and lockfile
COPY package.json bun.lock ./

# Install dependencies strictly matching the lockfile
RUN bun install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Compile TypeScript and build production assets with Vite
RUN bun run build

# --- Stage 2: Runtime Web Server ---
FROM nginx:alpine AS runner

# Remove default Nginx welcome configuration
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom Nginx configuration with WebAssembly MIME types & SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

# Health check using the /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/healthz || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
