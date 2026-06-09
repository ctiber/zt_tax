{{- with secret "secret/ob-zt/config" -}}
{{ .Data.jwt_secret }}
{{- end -}}
