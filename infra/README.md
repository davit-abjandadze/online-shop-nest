# AWS ინფრასტრუქტურა (Terraform)

აწყობს: private VPC (NAT Gateway-ით) + RDS Postgres + ECR + Secrets Manager + App Runner.

## წინაპირობა

- `terraform` >= 1.5, `aws` CLI კონფიგურირებული (`aws configure` ან SSO), `docker`.
- App Runner-ს **image უკვე უნდა არსებობდეს ECR-ში** სანამ სერვისს პირველად შექმნის —
  ამიტომ apply ორ ეტაპად კეთდება.

## 1) `terraform.tfvars` მოამზადეთ

```bash
cp terraform.tfvars.example terraform.tfvars
# შეავსეთ email_user / email_pass / frontend_url / cors_origins
```

## 2) პირველი apply — მხოლოდ ECR (და დანარჩენი non-App-Runner რესურსები)

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

(`terraform output ecr_repository_url` მოგცემთ ზუსტ URL-ს ხელახლა აკრეფის გარეშე.)

## 4) სრული apply (RDS + Secrets Manager + App Runner + ა.შ.)

```bash
cd infra
terraform apply
```

RDS-ისა და NAT Gateway-ის შექმნას რამდენიმე წუთი სჭირდება — ეს ნორმალურია.

## შემდეგი დეპლოები (კოდის ცვლილების შემდეგ)

`auto_deployments_enabled = false` (იხ. [apprunner.tf](apprunner.tf)) — ანუ ECR-ში ახალი
image-ის push ავტომატურად არ დეპლოის. ახალი ვერსიის გასუშვებად:

```bash
docker build -t referendum-backend .
docker tag referendum-backend:latest <ecr_repository_url>:latest
docker push <ecr_repository_url>:latest
aws apprunner start-deployment --service-arn <service-arn>
```

(`service-arn`-ს `terraform state show aws_apprunner_service.this` აჩვენებთ, ან App Runner-ის
კონსოლიდან.) გინდათ თუ არა ავტომატური redeploy ყოველ push-ზე — შეცვალეთ
`auto_deployments_enabled = true`.

## Migrations

Container ბუთზე production რეჟიმში (`NODE_ENV=production`) TypeORM ავტომატურად უშვებს
დაუმუშავებელ migration-ებს ([src/app.module.ts](../src/app.module.ts)-ის `migrationsRun`) — ცალკე
ნაბიჯი არ სჭირდება. ახალი migration-ის დამატება ლოკალურად:

```bash
yarn migration:generate src/migrations/SomeChange
```

## რა არ შედის აქ (განზრახ)

- **Route53/ACM domain** — App Runner-ს აქვს default HTTPS URL; საკუთარი დომენი დაამატეთ
  ცალკე `aws_apprunner_custom_domain_association`-ით, თუ დაგჭირდებათ.
- **Remote Terraform state (S3+DynamoDB lock)** — [versions.tf](versions.tf)-ში კომენტარშია, ჩართეთ
  გუნდურ მუშაობამდე.
- **CI/CD (GitHub Actions)** — ეს ფაილები მხოლოდ infra-ს ქმნის; build/push/deploy
  ავტომატიზაცია ცალკე workflow-ია.
