variable "aws_region" {
  description = "AWS რეგიონი"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "რესურსების სახელების პრეფიქსი"
  type        = string
  default     = "referendum-backend"
}

variable "db_name" {
  description = "Postgres database-ის სახელი"
  type        = string
  default     = "nest_db"
}

variable "db_username" {
  description = "Postgres master მომხმარებელი"
  type        = string
  default     = "postgres"
}

variable "db_instance_class" {
  description = "RDS instance ტიპი"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS storage (GB)"
  type        = number
  default     = 20
}

variable "ec2_instance_type" {
  description = "EC2 instance ტიპი — free tier-ის ფარგლებში (t3.micro/t2.micro, 750სთ/თვე, 12 თვე ახალი ანგარიშისთვის)"
  type        = string
  default     = "t3.micro"
}

variable "ecr_image_tag" {
  description = "რომელი image tag გაუშვას EC2-მ ECR-დან (პირველი apply-მდე image-ს push სჭირდება)"
  type        = string
  default     = "latest"
}

# --- ის env ცვლადები, რომლებსაც კონტეინერი production-ში ელოდება (main.ts/app.module.ts) ---

variable "jwt_expires_in" {
  type    = string
  default = "1h"
}

variable "email_user" {
  description = "Gmail მისამართი (EmailService)"
  type        = string
}

variable "email_pass" {
  description = "Gmail App Password (16-ნიშნა) — secret, .tfvars-ში ან env-ით მიეწოდოს"
  type        = string
  sensitive   = true
}

variable "frontend_url" {
  description = "ფრონტენდის მისამართი (reset-password ბმულისთვის)"
  type        = string
}

variable "cors_origins" {
  description = "დასაშვები frontend origin-ები, მძიმით გამოყოფილი (production დომენები)"
  type        = string
}
