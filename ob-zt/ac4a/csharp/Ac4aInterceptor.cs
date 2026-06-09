using System;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Threading.Tasks;
using Grpc.Core;
using Grpc.Core.Interceptors;
using Microsoft.IdentityModel.Tokens;

namespace cartservice.infrastructure
{
    public class Ac4aInterceptor : Interceptor
    {
        private static readonly bool Enabled =
            string.Equals(Environment.GetEnvironmentVariable("ZT_AC4A"), "true",
                StringComparison.OrdinalIgnoreCase);
        private static readonly string JwtSecret =
            Environment.GetEnvironmentVariable("JWT_SECRET") ?? "dev-secret-change-me";

        private void Verify(ServerCallContext context)
        {
            if (!Enabled) return;
            var auth = context.RequestHeaders.GetValue("authorization") ?? string.Empty;
            if (!auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                throw new RpcException(new Status(StatusCode.Unauthenticated, "missing bearer token"));
            var token = auth.Substring(7);
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
            try
            {
                handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.FromSeconds(30)
                }, out _);
            }
            catch (Exception e)
            {
                throw new RpcException(new Status(StatusCode.Unauthenticated,
                    $"invalid token: {e.Message}"));
            }
        }

        public override Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
            TRequest request, ServerCallContext context,
            UnaryServerMethod<TRequest, TResponse> continuation)
        {
            Verify(context);
            return continuation(request, context);
        }

        public override Task ServerStreamingServerHandler<TRequest, TResponse>(
            TRequest request, IServerStreamWriter<TResponse> responseStream,
            ServerCallContext context,
            ServerStreamingServerMethod<TRequest, TResponse> continuation)
        {
            Verify(context);
            return continuation(request, responseStream, context);
        }
    }
}
