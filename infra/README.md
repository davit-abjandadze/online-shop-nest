# AWS ინფრასტრუქტურა (Terraform) — 100% free-tier

აწყობს: VPC (NAT Gateway-ის **გარეშე**, ხარჯის ასარიდებლად) + RDS Postgres (`db.t4g.micro`, free
tier) + EC2 (`t3.micro`, free tier) + ECR + SSM Parameter Store (Secrets Manager-ის ნაცვლად, უფასო).

App Runner-ისა და Secrets Manager-ის ნაცვლად EC2 + SSM Parameter Store არჩეულია იმიტომ, რომ App
Runner-ს, NAT Gateway-ს და Secrets Manager-ს **საერთოდ არ აქვთ AWS free tier** — მუდმივად ფასდებიან
მოცულობის მიუხედავად. ეს setup მიზნად ისახავს **$0/თვე**-ს ახალი AWS ანგარიშისთვის (12 თვე free
tier-ის ფარგლებში).

## რა შედის free tier-ში (ახალი AWS ანგარიშისთვის, 12 თვე)

| რესურსი | Free tier ლიმიტი |
|---|---|
| EC2 `t3.micro` | 750სთ/თვე |
| RDS `db.t4g.micro`, 20GB gp2 | 750სთ/თვე + 20GB storage/backup |
| ECR | 500MB/თვე storage |
| SSM Parameter Store (standard) | უფასო, ლიმიტის გარეშე |
| Elastic IP | უფასო, სანამ running instance-ზეა მიბმული |
| Data transfer out | 100GB/თვე |

**⚠️ 12 თვის შემდეგ ეს resources აღარ იქნება უფასო** — მაშინ ან წაშალეთ (`terraform destroy`), ან
გადაერთეთ ფასიან instance-ებზე.

## წინაპირობა

- `terraform` >= 1.5, `aws` CLI კონფიგურირებული (`aws configure`), `docker`.
- IAM user-ს სჭირდება საკმარისი უფლებები (VPC/EC2/RDS/ECR/SSM/IAM resources-ის შესაქმნელად).

## 1) `terraform.tfvars` მოამზადეთ

```bash
cp terraform.tfvars.example terraform.tfvars
# შეავსეთ email_user / email_pass / frontend_url / cors_origins
```

## 2) პირველი apply — მხოლოდ ECR

```bash
terraform init
terraform apply -target=aws_ecr_repository.this
```

## 3) image-ის build & push

```bash
cd ..
aws ecr get-login-password --region eu-central-1 \
  | docker login --username AWS --password-stdin <account_id>.dkr.ecr.eu-central-1.amazonaws.com

docker build -t referendum-backend .
docker tag referendum-backend:latest <account_id>.dkr.ecr.eu-central-1.amazonaws.com/referendum-backend:latest
docker push <account_id>.dkr.ecr.eu-central-1.amazonaws.com/referendum-backend:latest
```

(`terraform output ecr_repository_url` მოგცემთ ზუსტ URL-ს.)

**შენიშვნა Windows/PowerShell-ზე:** `docker login --password-stdin` ზოგჯერ `400 Bad Request`-ს
აბრუნებს PowerShell-ის stdin encoding-ის გამო — Git Bash-იდან (ან WSL-იდან) გაუშვით, თუ ასე მოხდა.

## 4) სრული apply (VPC + RDS + SSM + EC2)

```bash
cd infra
terraform apply
```

RDS-ს რამდენიმე წუთი სჭირდება — ეს ნორმალურია. EC2-ის `user_data` ავტომატურად აყენებს Docker-ს და
პირველ deploy-საც (ECR-დან image-ის ჩამოქაჩვას, SSM-იდან secrets-ის წაკითხვას, კონტეინერის გაშვებას
პორტ 80-ზე) აკეთებს ბუთის დროს — ცალკე ნაბიჯი აღარ სჭირდება.

`terraform output backend_url`-ით მიიღებთ საბოლოო URL-ს (`http://<elastic-ip>`).

## შემდეგი დეპლოები (კოდის ცვლილების შემდეგ)

Deploy ხელახლა SSH-ის გარეშე, SSM Run Command-ით ხდება — instance-ს SSH პორტი საერთოდ არ აქვს
გახსნილი:

```bash
docker build -t referendum-backend .
docker tag referendum-backend:latest <ecr_repository_url>:latest
docker push <ecr_repository_url>:latest

aws ssm send-command \
  --instance-ids <ec2_instance_id> \
  --document-name "AWS-RunShellScript" \
  --parameters commands="/usr/local/bin/deploy.sh"
```

(`ec2_instance_id`-ს `terraform output ec2_instance_id` მოგცემთ.) `deploy.sh` (instance-ზე,
`/usr/local/bin/deploy.sh`) თავად უზრუნველყოფს ECR login-ს, `docker pull`-ს, SSM-იდან secrets-ის
წაკითხვას და კონტეინერის გადატვირთვას.

**Session Manager**-ით instance-ზე SSH-ის გარეშე შესვლა: `aws ssm start-session --target <instance-id>`.

## Migrations

Container ბუთზე production რეჟიმში (`NODE_ENV=production`) TypeORM ავტომატურად უშვებს
დაუმუშავებელ migration-ებს ([src/app.module.ts](../src/app.module.ts)-ის `migrationsRun`) — ცალკე
ნაბიჯი არ სჭირდება. ახალი migration-ის დამატება ლოკალურად:

```bash
yarn migration:generate src/migrations/SomeChange
```

## CI/CD (GitHub Actions)

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) `master`-ზე push-ზე აშენებს image-ს,
push-ავს ECR-ში (`:latest` და `:<git-sha>` ტეგებით) და `aws ssm send-command`-ს იძახებს, რომ
EC2-ზე `deploy.sh` ხელახლა გაუშვას — გრძელვადიანი AWS access key-ების გარეშე, GitHub-ის OIDC-ით
([github-oidc.tf](github-oidc.tf)-ით შექმნილი role).

`terraform apply`-ის შემდეგ, repo Settings → Secrets and variables → Actions → **Variables**-ში
დაამატეთ:

| Variable | წყარო |
|---|---|
| `AWS_ROLE_ARN` | `terraform output github_actions_role_arn` |
| `AWS_REGION` | `var.aws_region` (default `eu-central-1`) |
| `ECR_REPOSITORY` | `var.project_name` (default `referendum-backend`) |
| `EC2_INSTANCE_ID` | `terraform output ec2_instance_id` |

OIDC role-ის trust policy მხოლოდ `master` branch-იდან push/dispatch-ს უშვებს
(`github-oidc.tf`-ის `github_repository` variable-ით repo-ც არის შეზღუდული) — სხვა
branch-იდან workflow-ის გაშვება assume-ზე უარს ეტყვის.

## რა არ შედის აქ (განზრახ)

- **Route53/ACM domain, HTTPS** — EC2-ს default-ად მხოლოდ HTTP (პორტი 80) აქვს. საკუთარი დომენი
  (`evote.ge`) და HTTPS (Let's Encrypt/Certbot ან ALB+ACM) ცალკე დაამატეთ, თუ დაგჭირდებათ.
- **Remote Terraform state (S3+DynamoDB lock)** — [versions.tf](versions.tf)-ში კომენტარშია, ჩართეთ
  გუნდურ მუშაობამდე.
- **Auto-scaling/high-availability** — ერთი EC2 instance-ია (free tier-ის ფარგლებში); production
  ტრაფიკის ზრდისას საჭირო გახდება multi-instance/load balancer არქიტექტურაზე გადასვლა.
