FROM golang:1.23-bookworm AS builder
WORKDIR /app
COPY . .
RUN go mod init backend 2>/dev/null || true
RUN go get github.com/xtls/xray-core@v1.8.8
RUN go mod tidy
RUN CGO_ENABLED=1 GOOS=linux go build -o vpn-backend .

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y tzdata ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/vpn-backend .
RUN mkdir -p /app/data
EXPOSE 3000
ENTRYPOINT ["./vpn-backend"]
