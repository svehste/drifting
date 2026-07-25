CREATE TYPE "public"."advance_slot" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TYPE "public"."battle_round" AS ENUM('top32', 'top16', 'quarterfinal', 'semifinal', 'final', 'bronsefinal');--> statement-breakpoint
CREATE TYPE "public"."battle_status" AS ENUM('pending', 'omt', 'decided', 'bye');--> statement-breakpoint
CREATE TYPE "public"."criterion" AS ENUM('line', 'angle', 'style');--> statement-breakpoint
CREATE TYPE "public"."cup_size" AS ENUM('4', '8', '16', '32');--> statement-breakpoint
CREATE TYPE "public"."cup_status" AS ENUM('pending', 'in_progress', 'finished');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'ongoing', 'finished');--> statement-breakpoint
CREATE TYPE "public"."leaderboard_status" AS ENUM('in_progress', 'unofficial', 'official');--> statement-breakpoint
CREATE TYPE "public"."official_duty" AS ENUM('line', 'angle', 'style', 'battle');--> statement-breakpoint
CREATE TYPE "public"."race_status" AS ENUM('registration', 'qualifying', 'cup', 'finished');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'judge', 'secretary', 'driver');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'complete');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cup_id" uuid NOT NULL,
	"round" "battle_round" NOT NULL,
	"position" integer NOT NULL,
	"driver_a_registration_id" uuid,
	"driver_b_registration_id" uuid,
	"winner_registration_id" uuid,
	"omt_count" integer DEFAULT 0 NOT NULL,
	"status" "battle_status" DEFAULT 'pending' NOT NULL,
	"next_battle_id" uuid,
	"next_slot" "advance_slot",
	"loser_next_battle_id" uuid,
	"loser_next_slot" "advance_slot",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"size" "cup_size" NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"regenerations" integer DEFAULT 0 NOT NULL,
	"status" "cup_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cups_race_id_unique" UNIQUE("race_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_staff" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_staff_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "event_status" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qualifying_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"run_number" integer NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"total" integer,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "race_officials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"duty" "official_duty" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"class_id" uuid NOT NULL,
	"cup_size" "cup_size" NOT NULL,
	"max_line" integer DEFAULT 40 NOT NULL,
	"max_angle" integer DEFAULT 30 NOT NULL,
	"max_style_flow" integer DEFAULT 15 NOT NULL,
	"max_style_effort" integer DEFAULT 15 NOT NULL,
	"status" "race_status" DEFAULT 'registration' NOT NULL,
	"qualifying_locked" boolean DEFAULT false NOT NULL,
	"leaderboard_status" "leaderboard_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"qualifying_score" integer,
	"qualifying_rank" integer,
	"seed" integer,
	"eligible" boolean DEFAULT false NOT NULL,
	"final_place" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"criterion" "criterion" NOT NULL,
	"judge_user_id" uuid NOT NULL,
	"points" integer,
	"flow" integer,
	"effort" integer,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"auth_user_id" uuid,
	"start_number" text,
	"start_number_is_dummy" boolean DEFAULT false NOT NULL,
	"club" text,
	"car" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_driver_a_registration_id_registrations_id_fk" FOREIGN KEY ("driver_a_registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_driver_b_registration_id_registrations_id_fk" FOREIGN KEY ("driver_b_registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_registration_id_registrations_id_fk" FOREIGN KEY ("winner_registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_next_battle_id_battles_id_fk" FOREIGN KEY ("next_battle_id") REFERENCES "public"."battles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_loser_next_battle_id_battles_id_fk" FOREIGN KEY ("loser_next_battle_id") REFERENCES "public"."battles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cups" ADD CONSTRAINT "cups_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qualifying_runs" ADD CONSTRAINT "qualifying_runs_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "race_officials" ADD CONSTRAINT "race_officials_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "race_officials" ADD CONSTRAINT "race_officials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "races" ADD CONSTRAINT "races_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "races" ADD CONSTRAINT "races_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "registrations" ADD CONSTRAINT "registrations_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_scores" ADD CONSTRAINT "run_scores_run_id_qualifying_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."qualifying_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "run_scores" ADD CONSTRAINT "run_scores_judge_user_id_users_id_fk" FOREIGN KEY ("judge_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "battles_cup_round_position" ON "battles" USING btree ("cup_id","round","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qualifying_runs_reg_number" ON "qualifying_runs" USING btree ("registration_id","run_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "race_officials_one_per_criterion" ON "race_officials" USING btree ("race_id","duty") WHERE "race_officials"."duty" <> 'battle';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "race_officials_no_duplicate" ON "race_officials" USING btree ("race_id","user_id","duty");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "registrations_race_user" ON "registrations" USING btree ("race_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "run_scores_run_criterion" ON "run_scores" USING btree ("run_id","criterion");