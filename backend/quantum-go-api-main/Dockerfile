FROM rust:bookworm AS builder 

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    build-essential \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY src ./src
COPY Cargo.toml Cargo.lock build.rs ./
COPY katago/score-estimator-master ./katago/score-estimator-master
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gzip \
    libssl3 \
    libzip4 \
    zlib1g \
    libstdc++6 \
    libgomp1 \
    ocl-icd-libopencl1 \
    pocl-opencl-icd \
    && rm -rf /var/lib/apt/lists/*

# (No backports needed on bookworm; libssl3 is available in main.)

# Copy the binary from the builder stage
COPY --from=builder /app/target/release/quantum-go-api /usr/local/bin/

# Bundle KataGo assets into the image to avoid executing from a bind mount
WORKDIR /app
COPY katago/katago_opencl /app/katago
COPY katago/model /app/katago/model
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

# Download KataGo model at build time if missing (avoids relying on Git LFS during builds)
# You can override the URL and filename with build args.
ARG KATAGO_MODEL_FILE=kata9x9-b18c384nbt-20231025.bin.gz
ARG KATAGO_MODEL_URL=https://media.katagotraining.org/uploaded/networks/models_extra/kata9x9-b18c384nbt-20231025.bin.gz
ARG KATAGO_MODEL_SHA256=
ARG FORCE_MODEL_DOWNLOAD=1
RUN set -eux; \
    mkdir -p /app/katago/model; \
    # Determine if we need to download
    need_dl=${FORCE_MODEL_DOWNLOAD}; \
    if [ "$need_dl" -eq 0 ] && [ -f "/app/katago/model/${KATAGO_MODEL_FILE}" ]; then \
        size=$(wc -c < "/app/katago/model/${KATAGO_MODEL_FILE}" || echo 0); \
        if [ "$size" -lt 200000000 ]; then need_dl=1; fi; \
    fi; \
    if [ "$need_dl" -ne 0 ]; then \
        echo "Fetching KataGo model: ${KATAGO_MODEL_URL}"; \
        curl -fL --retry 5 --retry-delay 2 -o "/app/katago/model/${KATAGO_MODEL_FILE}.tmp" "${KATAGO_MODEL_URL}"; \
        if [ -n "${KATAGO_MODEL_SHA256}" ]; then \
            echo "${KATAGO_MODEL_SHA256}  /app/katago/model/${KATAGO_MODEL_FILE}.tmp" | sha256sum -c -; \
        fi; \
        gzip -t "/app/katago/model/${KATAGO_MODEL_FILE}.tmp"; \
        mv "/app/katago/model/${KATAGO_MODEL_FILE}.tmp" "/app/katago/model/${KATAGO_MODEL_FILE}"; \
    fi; \
    ls -lh /app/katago/model

# Set environment variables
ENV RUST_LOG=info
ENV DATABASE_URL=postgres://postgres:postgres@postgres:5432/quantum_go
# Sensible defaults so the app can run without extra env wiring
ENV KATAGO_BIN=/app/katago/katago_real
ENV KATAGO_MODEL=/app/katago/model/${KATAGO_MODEL_FILE}
ENV KATAGO_GTP_CONFIG=/app/katago/default_gtp.cfg
ENV KATAGO_OVERRIDES=backend=opencl,ponderingEnabled=false,maxTime=3.0,numSearchThreads=2,nnMaxBatchSize=2,nnCacheSizePowerOfTwo=14,logAllGTPCommunication=false,logSearchInfo=false,logToStderr=false,logDir=/tmp/gtp_logs

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["quantum-go-api"]
