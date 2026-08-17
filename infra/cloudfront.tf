# CloudFront EC2-ის (HTTP-only) წინ — უფასო HTTPS-ს გვაძლევს (*.cloudfront.net
# default certificate-ით, საკუთარი domain/ACM cert-ის გარეშეც) და აგვარიდებს
# mixed-content/OAuth-callback პრობლემებს, როცა frontend HTTPS-ზეა (Amplify).
# Free tier: 1TB გამავალი ტრაფიკი + 10მლნ მოთხოვნა/თვე, 12 თვე.

# "CachingDisabled" — API დინამიურია, CloudFront-მა არაფერი არ უნდა დაქეშოს.
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# "AllViewer" — ყველა header/cookie/query-სტrING გადაეცემა origin-ს
# (Authorization header და auth cookies backend-მდე რომ მივიდეს).
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "backend" {
  enabled     = true
  price_class = "PriceClass_100" # ევროპა+ჩრდ. ამერიკის edge-ები — უიაფესი, free tier-ს არ ეხება

  origin {
    domain_name = aws_instance.this.public_dns
    origin_id   = "ec2-backend"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only" # EC2-ს TLS არ აქვს, HTTPS მხოლოდ CloudFront-ის მხარეს
      origin_ssl_protocols     = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]
    target_origin_id = "ec2-backend"

    viewer_protocol_policy = "redirect-to-https"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${var.project_name}-cloudfront" }
}
