package hipstershop;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;

public class Ac4aInterceptor implements ServerInterceptor {

    private static final boolean ENABLED =
        "true".equalsIgnoreCase(System.getenv("ZT_AC4A"));
    private static final String JWT_SECRET =
        getEnv("JWT_SECRET", "dev-secret-change-me");
    private static final Metadata.Key<String> AUTH_KEY =
        Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER);

    @Override
    public <Q, R> ServerCall.Listener<Q> interceptCall(
            ServerCall<Q, R> call, Metadata headers, ServerCallHandler<Q, R> next) {
        if (!ENABLED) return next.startCall(call, headers);

        String auth = headers.get(AUTH_KEY);
        if (auth == null || !auth.startsWith("Bearer ")) {
            call.close(
                Status.UNAUTHENTICATED.withDescription("missing bearer token"),
                new Metadata());
            return new ServerCall.Listener<Q>() {};
        }
        try {
            Jwts.parser()
                .setSigningKey(JWT_SECRET.getBytes(StandardCharsets.UTF_8))
                .parseClaimsJws(auth.substring(7));
        } catch (Exception e) {
            call.close(
                Status.UNAUTHENTICATED.withDescription("invalid token: " + e.getMessage()),
                new Metadata());
            return new ServerCall.Listener<Q>() {};
        }
        return next.startCall(call, headers);
    }

    private static String getEnv(String key, String def) {
        String v = System.getenv(key);
        return (v != null && !v.isEmpty()) ? v : def;
    }
}
