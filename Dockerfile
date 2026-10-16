# ==========================================
# Stage 1: Build the native C++ addon
# ==========================================
FROM node:24-bookworm AS builder
WORKDIR /app

# 1. Install system compilation tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 2. Leverage layer cache for dependencies (Only runs if package.json shifts)
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# 3. Copy source files necessary for building the C++ binary
COPY binding.gyp addon.cpp ./
RUN npx node-gyp configure && npx node-gyp build

# ==========================================
# Stage 2: Production runtime environment
# ==========================================
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# 4. Copy package manifests for runtime dependency resolution
COPY package*.json tsconfig.json ./

# 5. Use cache mount for final dependencies to bypass network bottlenecks
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# 6. Copy the pre-compiled binary from the builder layer
COPY --from=builder /app/build/ /app/build/

# 7. Copy your TypeScript source files last 
# (Since these change the most, placing them last prevents cache busting above)
COPY index.ts jsMath.ts test.ts bench.ts ./

CMD ["npx", "tsx", "index.ts"]
