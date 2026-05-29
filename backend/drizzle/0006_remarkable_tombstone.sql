CREATE TABLE "gmail_oauth_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"refresh_token_enc" text,
	"access_token_enc" text,
	"access_expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_synced_msg_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_email_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gmail_msg_id" text NOT NULL,
	"subject" text,
	"from_addr" text,
	"received_at" timestamp with time zone,
	"raw_excerpt" text,
	"classification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"monto" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"categoria" text,
	"comercio_origen" text,
	"fecha_hora" timestamp with time zone DEFAULT now() NOT NULL,
	"canal_origen" text DEFAULT 'Manual' NOT NULL,
	"estado" text DEFAULT 'Borrador' NOT NULL,
	"legitimo" boolean DEFAULT true NOT NULL,
	"confidence" integer,
	"evidence_id" uuid,
	"recurrence" jsonb,
	"classification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gmail_oauth_tokens" ADD CONSTRAINT "gmail_oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_email_evidence" ADD CONSTRAINT "transaction_email_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tx_email_evidence_unique" ON "transaction_email_evidence" USING btree ("user_id","gmail_msg_id");--> statement-breakpoint
CREATE INDEX "tx_email_evidence_user_idx" ON "transaction_email_evidence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_estado_idx" ON "transactions" USING btree ("user_id","estado","fecha_hora" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_user_fecha_idx" ON "transactions" USING btree ("user_id","fecha_hora" DESC NULLS LAST);