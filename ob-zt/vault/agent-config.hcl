vault {
  address = "http://vault:8200"
}

auto_auth {
  method "approle" {
    config = {
      role_id_file_path   = "/vault/role_id"
      secret_id_file_path = "/vault/secret_id"
    }
  }

  sink "file" {
    config = {
      path = "/vault/token"
    }
  }
}

# Render JWT_SECRET into a file that the service reads at startup.
template {
  source      = "/vault/jwt-secret.tpl"
  destination = "/vault/secrets/jwt_secret"
  perms       = "0640"
}
