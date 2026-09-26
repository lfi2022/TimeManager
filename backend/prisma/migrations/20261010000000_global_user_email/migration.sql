-- An address identifies one employee account across the whole TempoPoint platform.
-- The migration deliberately fails if historical duplicates exist; resolve those accounts
-- by releasing the obsolete address or otherwise resolving the old account before applying the constraint.
CREATE UNIQUE INDEX "User_email_global_unique" ON "User" (lower("email"));