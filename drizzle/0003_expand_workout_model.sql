CREATE TYPE "public"."readiness_status" AS ENUM('Pending', 'Passed', 'Failed', 'Expired');--> statement-breakpoint
CREATE TYPE "public"."rest_status" AS ENUM('Scheduled', 'Fired', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."set_status" AS ENUM('Pending', 'Completed', 'Skipped');--> statement-breakpoint
CREATE TYPE "public"."workout_mode" AS ENUM('Reps', 'Duration');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('Active', 'Completed', 'Partial', 'Discarded');--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rest_period_id" uuid,
	"readiness_attempt_id" uuid,
	"subscription_id" uuid,
	"event_type" varchar(40) NOT NULL,
	"provider_message_id" varchar(255),
	"latency_ms" integer,
	"detail" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_receipts" (
	"operation_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"controller_epoch" integer NOT NULL,
	"expected_revision" integer NOT NULL,
	"command_type" varchar(40) NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "operation_receipts_revision_check" CHECK ("controller_epoch" > 0 AND "expected_revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"worker_version" varchar(100),
	"installed" boolean DEFAULT false NOT NULL,
	"readiness_passed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "readiness_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"subscription_id" uuid,
	"nonce" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" "readiness_status" DEFAULT 'Pending' NOT NULL,
	"dispatched_at" timestamp,
	"acknowledged_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rest_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"completed_set_id" uuid,
	"current_set_id" uuid,
	"status" "rest_status" DEFAULT 'Scheduled' NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"due_at" timestamp NOT NULL,
	"controller_epoch" integer NOT NULL,
	"next_exercise_name" varchar(100),
	"next_set_number" integer,
	"next_set_count" integer,
	"next_mode" "workout_mode",
	"next_reps_min" integer,
	"next_reps_max" integer,
	"next_target_seconds" integer,
	"qstash_message_id" varchar(255),
	"fired_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rest_periods_epoch_check" CHECK ("controller_epoch" > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"label" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "reps_min" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "reps_max" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "template_exercise_id" uuid;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "exercise_name" varchar(100);--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "set_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "mode" "workout_mode" DEFAULT 'Reps' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "reps_min" integer;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "reps_max" integer;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "target_seconds" integer;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "rpe_target" integer;--> statement-breakpoint
ALTER TABLE "session_exercises" ADD COLUMN "rest_time_seconds" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "status" "set_status" DEFAULT 'Pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "mode" "workout_mode" DEFAULT 'Reps' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "external_load_kg" numeric(7, 3) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "actual_reps" integer;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "actual_seconds" integer;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "mode" "workout_mode" DEFAULT 'Reps' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "target_seconds" integer;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "status" "workout_status" DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "controller_epoch" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "controller_device_id" uuid;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "template_name" varchar(50);--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "template_day_number" integer;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_rest_period_id_rest_periods_id_fk" FOREIGN KEY ("rest_period_id") REFERENCES "public"."rest_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_readiness_attempt_id_readiness_attempts_id_fk" FOREIGN KEY ("readiness_attempt_id") REFERENCES "public"."readiness_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_receipts" ADD CONSTRAINT "operation_receipts_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_device_id_workout_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."workout_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_attempts" ADD CONSTRAINT "readiness_attempts_device_id_workout_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."workout_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_attempts" ADD CONSTRAINT "readiness_attempts_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rest_periods" ADD CONSTRAINT "rest_periods_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rest_periods" ADD CONSTRAINT "rest_periods_completed_set_id_session_sets_id_fk" FOREIGN KEY ("completed_set_id") REFERENCES "public"."session_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rest_periods" ADD CONSTRAINT "rest_periods_current_set_id_session_sets_id_fk" FOREIGN KEY ("current_set_id") REFERENCES "public"."session_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_devices" ADD CONSTRAINT "workout_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_delivery_events_rest_period_id" ON "delivery_events" USING btree ("rest_period_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_events_readiness_attempt_id" ON "delivery_events" USING btree ("readiness_attempt_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_events_occurred_at" ON "delivery_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_operation_receipts_session_id" ON "operation_receipts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_device_id" ON "push_subscriptions" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_push_subscriptions_endpoint" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_push_subscriptions_active_device" ON "push_subscriptions" USING btree ("device_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_readiness_attempts_device_id" ON "readiness_attempts" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_readiness_attempts_nonce" ON "readiness_attempts" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "idx_rest_periods_session_id" ON "rest_periods" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rest_periods_token" ON "rest_periods" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rest_periods_current_scheduled" ON "rest_periods" USING btree ("session_id") WHERE "status" = 'Scheduled';--> statement-breakpoint
CREATE INDEX "idx_workout_devices_user_id" ON "workout_devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workout_devices_user_device" ON "workout_devices" USING btree ("user_id","device_id");--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_template_exercise_id_template_exercises_id_fk" FOREIGN KEY ("template_exercise_id") REFERENCES "public"."template_exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_controller_device_id_workout_devices_id_fk" FOREIGN KEY ("controller_device_id") REFERENCES "public"."workout_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
