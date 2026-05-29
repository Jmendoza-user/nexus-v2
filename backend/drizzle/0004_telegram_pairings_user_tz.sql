CREATE TABLE "telegram_pairings" (
	"pairing_code" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'America/Bogota' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_pairings" ADD CONSTRAINT "telegram_pairings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_pairings_user_idx" ON "telegram_pairings" USING btree ("user_id");