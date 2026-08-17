terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # რეკომენდებულია remote backend (S3 + DynamoDB lock) production-ისთვის,
  # რომ state ერთ ლეპტოპზე არ იყოს "ჭერილი". სასწრაფოდ, local state-იც კმარა.
  # backend "s3" {
  #   bucket = "your-tfstate-bucket"
  #   key    = "referendum-backend/terraform.tfstate"
  #   region = "eu-central-1"
  # }
}

provider "aws" {
  region = var.aws_region
}
