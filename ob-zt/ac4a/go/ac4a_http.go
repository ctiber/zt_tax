// HTTP middleware for the OB frontend service.
// Verifies the JWT from the Authorization header when ZT_AC4A=true.
package ac4a

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const JWTTokenKey contextKey = "zt-jwt-token"

// HTTPMiddleware wraps an http.Handler, verifying the JWT when ZT_AC4A=true.
// It also stores the raw token string in the request context so that
// PropagateInterceptor (ac4a_propagate.go) can attach it to outgoing gRPC calls.
func HTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !enabled {
			next.ServeHTTP(w, r)
			return
		}
		// Accept token from Authorization header OR the forwarded X-Zt-Authorization
		// header that the ZT gateway sets (so the frontend always sees the token).
		auth := r.Header.Get("Authorization")
		if auth == "" {
			auth = r.Header.Get("X-Zt-Authorization")
		}
		if auth == "" {
			http.Error(w, "unauthorized: missing token", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		_, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret, nil
		}, jwt.WithValidMethods([]string{"HS256"}))
		if err != nil {
			http.Error(w, "unauthorized: invalid token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), JWTTokenKey, tokenStr)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
