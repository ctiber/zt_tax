// Package ac4a provides gRPC server interceptors for the AC4A and RA-MS ZT primitives.
// AC4A: enable with ZT_AC4A=true; shared JWT secret via JWT_SECRET env var.
// RA-MS: enable with ZT_RA_MS=true; RA endpoint via RA_URL env var.
package ac4a

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var (
	enabled   = os.Getenv("ZT_AC4A") == "true"
	raEnabled = os.Getenv("ZT_RA_MS") == "true"
	raURL     = strings.TrimRight(getEnvOrDefault("RA_URL", "http://risk-analysis:5002"), "/") + "/analyze"
	jwtSecret = []byte(getEnvOrDefault("JWT_SECRET", "dev-secret-change-me"))
	raClient  = &http.Client{Timeout: 2 * time.Second}
)

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// userIDFromContext extracts the userId claim from the Bearer JWT in gRPC metadata.
// Returns "anonymous" if the token is absent or unparseable.
func userIDFromContext(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "anonymous"
	}
	vals := md.Get("authorization")
	if len(vals) == 0 {
		return "anonymous"
	}
	tokenStr := strings.TrimPrefix(vals[0], "Bearer ")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !token.Valid {
		return "anonymous"
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		if uid, ok := claims["userId"].(string); ok && uid != "" {
			return uid
		}
	}
	return "anonymous"
}

// callRA sends request metadata to the RA service. Returns a gRPC
// PermissionDenied error if the request is blocked; nil otherwise.
// Fails open on any network or parse error so RA unavailability never
// takes down the service.
func callRA(ctx context.Context, grpcMethod string) error {
	if !raEnabled {
		return nil
	}
	body, _ := json.Marshal(map[string]string{
		"userId": userIDFromContext(ctx),
		"method": "GRPC",
		"path":   grpcMethod,
	})
	resp, err := raClient.Post(raURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil // fail open
	}
	defer resp.Body.Close()
	var result struct {
		Block bool `json:"block"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || !result.Block {
		return nil
	}
	return status.Error(codes.PermissionDenied, "request blocked by risk analysis")
}

func verifyFromContext(ctx context.Context) error {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Error(codes.Unauthenticated, "missing metadata")
	}
	vals := md.Get("authorization")
	if len(vals) == 0 {
		return status.Error(codes.Unauthenticated, "missing authorization metadata")
	}
	tokenStr := strings.TrimPrefix(vals[0], "Bearer ")
	_, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return jwtSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
	}
	return nil
}

// injectTokenContext copies the raw JWT string from incoming gRPC metadata
// into context.Value(JWTTokenKey) so that PropagateUnaryInterceptor can
// attach it to outgoing downstream gRPC calls.
func injectTokenContext(ctx context.Context) context.Context {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ctx
	}
	vals := md.Get("authorization")
	if len(vals) == 0 {
		return ctx
	}
	tokenStr := strings.TrimPrefix(vals[0], "Bearer ")
	if tokenStr == "" {
		return ctx
	}
	return context.WithValue(ctx, JWTTokenKey, tokenStr)
}

// wrappedStream lets the StreamInterceptor inject a modified context.
type wrappedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w wrappedStream) Context() context.Context { return w.ctx }

// UnaryInterceptor is a gRPC unary server interceptor that verifies the JWT
// (when ZT_AC4A=true) and/or calls the RA service (when ZT_RA_MS=true).
// It also injects the token into the handler context for downstream propagation.
func UnaryInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	if !enabled && !raEnabled {
		return handler(ctx, req)
	}
	if enabled {
		if err := verifyFromContext(ctx); err != nil {
			return nil, err
		}
	}
	if err := callRA(ctx, info.FullMethod); err != nil {
		return nil, err
	}
	return handler(injectTokenContext(ctx), req)
}

// StreamInterceptor is a gRPC streaming server interceptor that verifies the JWT
// (when ZT_AC4A=true) and/or calls the RA service (when ZT_RA_MS=true).
// It also injects the token into the stream context for downstream propagation.
func StreamInterceptor(
	srv interface{},
	ss grpc.ServerStream,
	info *grpc.StreamServerInfo,
	handler grpc.StreamHandler,
) error {
	ctx := ss.Context()
	if !enabled && !raEnabled {
		return handler(srv, ss)
	}
	if enabled {
		if err := verifyFromContext(ctx); err != nil {
			return err
		}
	}
	if err := callRA(ctx, info.FullMethod); err != nil {
		return err
	}
	return handler(srv, wrappedStream{ss, injectTokenContext(ctx)})
}
