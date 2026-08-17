output "ecr_repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "apprunner_service_url" {
  value = "https://${aws_apprunner_service.this.service_url}"
}

output "rds_endpoint" {
  value = aws_db_instance.this.address
}

output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}
