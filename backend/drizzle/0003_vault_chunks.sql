CREATE TABLE "vault_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"note_path" text NOT NULL,
	"chunk_idx" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_chunks" ADD CONSTRAINT "vault_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vault_chunks_unique" ON "vault_chunks" USING btree ("user_id","note_path","chunk_idx");--> statement-breakpoint
CREATE INDEX "vault_chunks_user_idx" ON "vault_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vault_chunks_embedding_hnsw" ON "vault_chunks" USING hnsw ("embedding" vector_cosine_ops);