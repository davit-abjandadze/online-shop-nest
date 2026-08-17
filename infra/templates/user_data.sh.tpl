#!/bin/bash
set -e

dnf install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# deploy.sh — ECR-დან უახლესი image-ის ჩამოქაჩვა, SSM Parameter Store-დან
# secrets-ის წაკითხვა და კონტეინერის გადატვირთვა. ერთხელ ეშვება boot-ზე
# (ქვემოთ), მერე კი CI/CD-დან იგივე script-ს იძახებს `aws ssm send-command`.
cat > /usr/local/bin/deploy.sh <<'DEPLOY_EOF'
#!/bin/bash
set -e

aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_registry}

docker pull ${ecr_image}

DB_PASSWORD=$(aws ssm get-parameter --region ${aws_region} --name "${db_password_param}" --with-decryption --query Parameter.Value --output text)
JWT_SECRET=$(aws ssm get-parameter --region ${aws_region} --name "${jwt_secret_param}" --with-decryption --query Parameter.Value --output text)
EMAIL_PASS=$(aws ssm get-parameter --region ${aws_region} --name "${email_pass_param}" --with-decryption --query Parameter.Value --output text)

docker stop referendum-backend >/dev/null 2>&1 || true
docker rm referendum-backend >/dev/null 2>&1 || true

docker run -d \
  --name referendum-backend \
  --restart unless-stopped \
  -p 80:4000 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e DB_HOST="${db_host}" \
  -e DB_PORT="${db_port}" \
  -e DB_USERNAME="${db_username}" \
  -e DB_DATABASE="${db_name}" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e JWT_EXPIRES_IN="${jwt_expires_in}" \
  -e EMAIL_USER="${email_user}" \
  -e EMAIL_PASS="$EMAIL_PASS" \
  -e FRONTEND_URL="${frontend_url}" \
  -e CORS_ORIGINS="${cors_origins}" \
  ${ecr_image}
DEPLOY_EOF

chmod +x /usr/local/bin/deploy.sh
/usr/local/bin/deploy.sh
