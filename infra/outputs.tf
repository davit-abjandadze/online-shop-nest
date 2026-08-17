output "ecr_repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "backend_url" {
  value = "http://${aws_eip.ec2.public_ip}"
}

output "ec2_instance_id" {
  value = aws_instance.this.id
}

output "ec2_public_ip" {
  value = aws_eip.ec2.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.this.address
}
