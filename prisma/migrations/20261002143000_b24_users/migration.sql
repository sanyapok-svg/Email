ALTER TABLE "b24_recipients" ADD COLUMN "login" TEXT NOT NULL DEFAULT '';
ALTER TABLE "b24_recipients" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'Менеджер';
ALTER TABLE "b24_recipients" ADD COLUMN "number" SERIAL NOT NULL;

CREATE UNIQUE INDEX "b24_recipients_number_key" ON "b24_recipients"("number");
