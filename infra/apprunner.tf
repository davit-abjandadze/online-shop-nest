# App Runner-ს, VPC connector-ის მიბმის შემდეგ, ამ security group-იდან გამოსდის
# ტრაფიკი — RDS-ის SG (rds.tf) სწორედ ამის მიხედვით უშვებს 5432-ს.
resource "aws_security_group" "apprunner" {
  name        = "${var.project_name}-apprunner-sg"
  description = "App Runner VPC connector egress"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-apprunner-sg" }
}

resource "aws_apprunner_vpc_connector" "this" {
  vpc_connector_name = "${var.project_name}-connector"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner.id]
}

# max_size = 1 განზრახაა: QuestionService-ის @Cron job-ები ([app.module.ts](../src/app.module.ts)-ის
# ScheduleModule-ით) in-process მუშაობს — რამდენიმე instance-ი ერთსა და იმავე
# cron-ს რამდენჯერმე გაუშვებდა. თუ მომავალში ტრაფიკი გაიზრდება და ჰორიზონტალური
# scaling დაგჭირდებათ, job-ები ჯერ EventBridge Scheduler-ზე/ცალკე worker-ზე გადაიტანეთ.
resource "aws_apprunner_auto_scaling_configuration_version" "this" {
  auto_scaling_configuration_name = "${var.project_name}-scaling"
  min_size                        = 1
  max_size                        = 1
  max_concurrency                 = 100
}

resource "aws_apprunner_service" "this" {
  service_name = var.project_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    # false: ხელით/CI-დან push-ის შემდეგ ცალკე დეპლოი (`aws apprunner start-deployment`).
    # ცვალეთ true-ზე, თუ გინდათ ECR-ში ყოველ push-ზე ავტომატური redeploy.
    auto_deployments_enabled = false

    image_repository {
      image_identifier      = "${aws_ecr_repository.this.repository_url}:${var.ecr_image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "4000"

        runtime_environment_variables = {
          NODE_ENV     = "production"
          PORT         = "4000"
          DB_HOST      = aws_db_instance.this.address
          DB_PORT      = tostring(aws_db_instance.this.port)
          DB_USERNAME  = var.db_username
          DB_DATABASE  = var.db_name
          JWT_EXPIRES_IN = var.jwt_expires_in
          EMAIL_USER   = var.email_user
          FRONTEND_URL = var.frontend_url
          CORS_ORIGINS = var.cors_origins
        }

        runtime_environment_secrets = {
          DB_PASSWORD = aws_secretsmanager_secret.db_password.arn
          JWT_SECRET  = aws_secretsmanager_secret.jwt_secret.arn
          EMAIL_PASS  = aws_secretsmanager_secret.email_pass.arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = var.apprunner_cpu
    memory            = var.apprunner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.this.arn
    }
  }

  health_check_configuration {
    protocol = "HTTP"
    path     = "/api"
    interval = 10
    timeout  = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.this.arn

  tags = { Name = var.project_name }
}
