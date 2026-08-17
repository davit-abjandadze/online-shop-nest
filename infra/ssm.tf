# Secrets Manager-ის ნაცვლად SSM Parameter Store (SecureString, default
# aws/ssm KMS key-ით) — Secrets Manager-ს $0.40/secret/თვე ღირს, Parameter
# Store-ის standard tier კი მთლიანად უფასოა.

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/${var.project_name}/db-password"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project_name}/jwt-secret"
  type  = "SecureString"
  value = random_password.jwt.result
}

resource "aws_ssm_parameter" "email_pass" {
  name  = "/${var.project_name}/email-pass"
  type  = "SecureString"
  value = var.email_pass
}
