ALTER TABLE "service_users" ADD COLUMN "email" TEXT;
ALTER TABLE "service_users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "service_users_email_key" ON "service_users"("email");
