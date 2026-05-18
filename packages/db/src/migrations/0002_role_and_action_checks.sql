-- Enforce allowed role values on user_meta.role (ADR-006 alignment with shared Role enum).
ALTER TABLE "user_meta"
  ADD CONSTRAINT "user_meta_role_check"
  CHECK ("role" IN ('guest','viewer','sub','vip','mod','broadcaster'));
--> statement-breakpoint
-- Enforce domain.verb format on audit_logs.action.
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_action_format_check"
  CHECK ("action" ~ '^[a-z0-9_]+\.[a-z0-9_]+$');
