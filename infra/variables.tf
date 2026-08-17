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

variable "apprunner_cpu" {
  description = "App Runner CPU (App Runner-ის დასაშვები მნიშვნელობები: 256/512/1024/2048/4096)"
  type        = string
  default     = "256"
}

variable "apprunner_memory" {
  description = "App Runner RAM (MB) — 256 CPU-სთვის დასაშვებია 512 ან 1024"
  type        = string
  default     = "512"
}

variable "ecr_image_tag" {
  description = "რომელი image tag გაუშვას App Runner-მა ECR-დან (პირველი apply-მდე image-ს push სჭირდება)"
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
