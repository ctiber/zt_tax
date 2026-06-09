FROM golang:1.22.5-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go get github.com/golang-jwt/jwt/v5@latest
RUN CGO_ENABLED=0 GOOS=linux go build -o /go/bin/frontend .

FROM scratch
WORKDIR /src
COPY --from=builder /go/bin/frontend /src/server
COPY ./templates ./templates
COPY ./static ./static
ENTRYPOINT ["/src/server"]
