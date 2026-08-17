resource "random_password" "db" {
  length  = 24
  special = false # RDS-ის master password-ში ზოგიერთი სიმბოლო (@, /, ") პრობლემურია
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project_name}-db-subnets" }
}

# მხოლოდ EC2-ის security group-იდან 5432-ზე შემოსვლა.
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Postgres access only from the backend EC2 instance"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}

resource "aws_security_group_rule" "rds_from_ec2" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ec2.id
}

resource "aws_db_instance" "this" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  # gp2 (და არა gp3) — AWS free tier-ის "20 GB General Purpose SSD storage"
  # ზუსტად gp2-ს გულისხმობს; gp3-ს ცალკე ფასდება.
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # hobby/small-scale პროექტისთვის საკმარისია — production ტრაფიკის ზრდისას
  # ჩართეთ multi_az = true (ორმაგდება ღირებულებაც).
  multi_az = false
  # free tier ანგარიშებზე backup retention 7 დღეზე მეტს არ უშვებს — 1 დღეზე
  # ვამცირებთ, რომ FreeTierRestrictionError არ დაგვხვდეს.
  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = { Name = "${var.project_name}-db" }
}
