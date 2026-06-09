import os
import grpc
import jwt as pyjwt

ZT_AC4A = os.getenv("ZT_AC4A", "false").lower() == "true"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"


def _verify(context):
    meta = dict(context.invocation_metadata())
    auth = meta.get("authorization", "")
    if not auth.startswith("Bearer "):
        context.abort(grpc.StatusCode.UNAUTHENTICATED, "missing bearer token")
        return False
    try:
        pyjwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return True
    except pyjwt.exceptions.InvalidTokenError as exc:
        context.abort(grpc.StatusCode.UNAUTHENTICATED, str(exc))
        return False


class Ac4aInterceptor(grpc.ServerInterceptor):
    def intercept_service(self, continuation, handler_call_details):
        if not ZT_AC4A:
            return continuation(handler_call_details)

        handler = continuation(handler_call_details)
        if handler is None:
            return None

        def _gate(fn):
            def wrapper(req_or_iter, context):
                if not _verify(context):
                    return None
                return fn(req_or_iter, context)
            return wrapper

        replacements = {
            field: _gate(getattr(handler, field))
            for field in ("unary_unary", "unary_stream", "stream_unary", "stream_stream")
            if getattr(handler, field) is not None
        }
        return handler._replace(**replacements)
