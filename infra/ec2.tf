# App Runner-ის ნაცვლად: ერთი EC2 (t3.micro, free tier — 750სთ/თვე, 12 თვე
# ახალი AWS ანგარიშისთვის), public subnet-ში, Elastic IP-ით. SSH პორტი
# საერთოდ არ იხსნება — წვდომა/deploy SSM Session Manager & Run Command-ით
# ხდება (iam.tf-ის AmazonSSMManagedInstanceCore role-ით), რაც უფასოა.

data "aws_caller_identity" "current" {}

locals {
  ecr_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  ecr_image    = "${aws_ecr_repository.this.repository_url}:${var.ecr_image_tag}"
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "Allow HTTP from anywhere; SSH is closed, managed via SSM instead"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ec2-sg" }
}

resource "aws_instance" "this" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = templatefile("${path.module}/templates/user_data.sh.tpl", {
    aws_region        = var.aws_region
    ecr_registry      = local.ecr_registry
    ecr_image         = local.ecr_image
    db_password_param = aws_ssm_parameter.db_password.name
    jwt_secret_param  = aws_ssm_parameter.jwt_secret.name
    email_pass_param  = aws_ssm_parameter.email_pass.name
    db_host           = aws_db_instance.this.address
    db_port           = tostring(aws_db_instance.this.port)
    db_username       = var.db_username
    db_name           = var.db_name
    jwt_expires_in    = var.jwt_expires_in
    email_user        = var.email_user
    frontend_url      = var.frontend_url
    cors_origins      = var.cors_origins
  })

  # user_data-ის ცვლილებაზე instance-ის ხელახლა შექმნის ნაცვლად, deploy.sh
  # ხელახლა გაეშვება SSM-ით (deploy.yml-ის მსგავსად) — replace ყოველ tfvars
  # ცვლილებაზე overkill იქნებოდა.
  user_data_replace_on_change = false

  tags = { Name = "${var.project_name}-backend" }
}

resource "aws_eip" "ec2" {
  domain   = "vpc"
  instance = aws_instance.this.id

  depends_on = [aws_internet_gateway.this]
  tags       = { Name = "${var.project_name}-ec2-eip" }
}
