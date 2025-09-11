FROM rust:bookworm AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY src ./src
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libzip4 \
    zlib1g \
    libstdc++6 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# (No backports needed on bookworm; libssl3 is available in main.)

# Copy the binary from the builder stage
COPY --from=builder /app/target/release/quantum-go-api /usr/local/bin/

# Bundle KataGo assets into the image to avoid executing from a bind mount
WORKDIR /app
COPY katago /app/katago
# If the provided katago is an AppImage, extract the real binary so we don't need FUSE in container.
RUN set -eux; \
    cd /app/katago; \
    chmod +x katago || true; \
    ./katago --appimage-extract || true; \
    if [ -f squashfs-root/usr/bin/katago ]; then \
        cp squashfs-root/usr/bin/katago /app/katago/katago_real; \
        chmod +x /app/katago/katago_real; \
        rm -rf squashfs-root; \
    else \
        cp /app/katago/katago /app/katago/katago_real; \
        chmod +x /app/katago/katago_real || true; \
    fi

# Set environment variables
ENV RUST_LOG=info
ENV DATABASE_URL=postgres://postgres:postgres@postgres:5432/quantum_go

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["quantum-go-api"]
