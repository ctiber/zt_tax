// Outgoing gRPC client interceptor: propagates the JWT from the HTTP request
// context to outgoing gRPC metadata so that downstream services can verify it.
// Use this on the OB frontend's gRPC dial options when ZT_AC4A=true.
package ac4a

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// PropagateUnaryInterceptor attaches the JWT from context to outgoing gRPC metadata.
func PropagateUnaryInterceptor(
	ctx context.Context,
	method string,
	req, reply interface{},
	cc *grpc.ClientConn,
	invoker grpc.UnaryInvoker,
	opts ...grpc.CallOption,
) error {
	ctx = attachToken(ctx)
	return invoker(ctx, method, req, reply, cc, opts...)
}

// PropagateStreamInterceptor attaches the JWT from context to outgoing gRPC stream metadata.
func PropagateStreamInterceptor(
	ctx context.Context,
	desc *grpc.StreamDesc,
	cc *grpc.ClientConn,
	method string,
	streamer grpc.Streamer,
	opts ...grpc.CallOption,
) (grpc.ClientStream, error) {
	ctx = attachToken(ctx)
	return streamer(ctx, desc, cc, method, opts...)
}

func attachToken(ctx context.Context) context.Context {
	if !enabled {
		return ctx
	}
	token, ok := ctx.Value(JWTTokenKey).(string)
	if !ok || token == "" {
		return ctx
	}
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		md = metadata.New(nil)
	} else {
		md = md.Copy()
	}
	md.Set("authorization", "Bearer "+token)
	return metadata.NewOutgoingContext(ctx, md)
}
