ALTER TABLE "Subscription" ADD COLUMN "extraSeats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_extraSeats_nonnegative" CHECK ("extraSeats" >= 0);