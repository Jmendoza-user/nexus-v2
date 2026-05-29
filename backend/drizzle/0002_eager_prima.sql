CREATE TABLE "tier_policies" (
	"tier" text PRIMARY KEY NOT NULL,
	"default_adapter" text DEFAULT 'opencode' NOT NULL,
	"default_model" text NOT NULL,
	"allowed_adapters" jsonb DEFAULT '["opencode"]'::jsonb NOT NULL,
	"quota_messages" bigint NOT NULL,
	"quota_voice_seconds" bigint NOT NULL,
	"quota_vault_bytes" bigint NOT NULL
);
