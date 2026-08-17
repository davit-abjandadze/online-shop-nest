# GitHub Actions-ს გრძელვადიანი AWS access key-ების გარეშე დავუშვებთ deploy-ს —
# GitHub-ის OIDC provider-ს ვენდობით, roll-ს კი მხოლოდ ეს კონკრეტული repo იღებს.

variable "github_repository" {
  description = "GitHub repo \"owner/name\" ფორმატში, ვისაც ამ role-ის assume-ის უფლება ექნება"
  type        = string
  default     = "davit-abjandadze/my-first-nest-app"
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # master branch-ზე push-იც და workflow_dispatch-იც (ორივეს "ref:refs/heads/master"
    # claim აქვს ბოლო შემთხვევაშიც, თუ master-იდან გაუშვით ხელით) დაშვებულია, სხვა
    # branch/PR-ს — არა. თუ სხვა branch-იდანაც გინდათ deploy, აქ დაამატეთ.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/master"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project_name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid       = "ECRAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "ECRPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [aws_ecr_repository.this.arn]
  }

  statement {
    sid       = "AppRunnerDeploy"
    actions   = ["apprunner:StartDeployment", "apprunner:DescribeService"]
    resources = [aws_apprunner_service.this.arn]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "${var.project_name}-github-actions-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}
