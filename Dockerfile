FROM golang:1.21 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o main .

FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates

RUN adduser -D appuser

COPY --from=builder /app/main .

USER appuser

EXPOSE 8080

CMD ["./main"]
