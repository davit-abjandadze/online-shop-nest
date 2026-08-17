# api.evote.ge -> CloudFront-ის (backend) custom domain. ACM cert აუცილებლად
# us-east-1-ში უნდა იყოს გამოშვებული, CloudFront-ს სხვაგან არ შეუძლია მისი წაკითხვა.

variable "backend_domain" {
  description = "Backend-ის custom domain (CloudFront alias-ისთვის)"
  type        = string
  default     = "api.evote.ge"
}

resource "aws_acm_certificate" "backend" {
  provider          = aws.us_east_1
  domain_name       = var.backend_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-backend-cert" }
}

resource "aws_acm_certificate_validation" "backend" {
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.backend.arn
}

output "backend_cert_validation_record" {
  description = "ეს CNAME დაამატეთ DNS-ში, რომ ACM-მა სერტიფიკატი დაადასტუროს"
  value = {
    name  = tolist(aws_acm_certificate.backend.domain_validation_options)[0].resource_record_name
    type  = tolist(aws_acm_certificate.backend.domain_validation_options)[0].resource_record_type
    value = tolist(aws_acm_certificate.backend.domain_validation_options)[0].resource_record_value
  }
}
