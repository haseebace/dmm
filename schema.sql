


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."update_oauth_tokens_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_oauth_tokens_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."file_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "folder_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "real_debrid_id" character varying(255) NOT NULL,
    "filename" character varying(255) NOT NULL,
    "file_size" bigint,
    "mime_type" character varying(255),
    "download_url" "text",
    "hoster" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(7),
    "parent_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_type" "text" DEFAULT 'Bearer'::"text" NOT NULL,
    "expires_in" integer NOT NULL,
    "scope" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "oauth_tokens_access_token_not_empty" CHECK (("length"("access_token") > 0)),
    CONSTRAINT "oauth_tokens_expires_in_positive" CHECK (("expires_in" > 0)),
    CONSTRAINT "oauth_tokens_user_id_not_empty" CHECK (("length"("user_id") > 0))
);


ALTER TABLE "public"."oauth_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "real_debrid_id" character varying(255) NOT NULL,
    "username" character varying(255),
    "email" character varying(255),
    "avatar_url" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."file_folders"
    ADD CONSTRAINT "file_folders_file_id_folder_id_key" UNIQUE ("file_id", "folder_id");



ALTER TABLE ONLY "public"."file_folders"
    ADD CONSTRAINT "file_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_real_debrid_id_key" UNIQUE ("real_debrid_id");



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_real_debrid_id_key" UNIQUE ("real_debrid_id");



CREATE INDEX "idx_file_folders_file_id" ON "public"."file_folders" USING "btree" ("file_id");



CREATE INDEX "idx_file_folders_folder_id" ON "public"."file_folders" USING "btree" ("folder_id");



CREATE INDEX "idx_file_folders_unique" ON "public"."file_folders" USING "btree" ("file_id", "folder_id");



CREATE INDEX "idx_files_filename" ON "public"."files" USING "btree" ("filename");



CREATE INDEX "idx_files_real_debrid_id" ON "public"."files" USING "btree" ("real_debrid_id");



CREATE INDEX "idx_files_user_filename" ON "public"."files" USING "btree" ("user_id", "filename");



CREATE INDEX "idx_files_user_id" ON "public"."files" USING "btree" ("user_id");



CREATE INDEX "idx_folders_parent_id" ON "public"."folders" USING "btree" ("parent_id");



CREATE INDEX "idx_folders_sort_order" ON "public"."folders" USING "btree" ("sort_order");



CREATE INDEX "idx_folders_user_id" ON "public"."folders" USING "btree" ("user_id");



CREATE INDEX "idx_folders_user_parent" ON "public"."folders" USING "btree" ("user_id", "parent_id");



CREATE INDEX "idx_oauth_tokens_updated_at" ON "public"."oauth_tokens" USING "btree" ("updated_at");



CREATE INDEX "idx_oauth_tokens_user_id" ON "public"."oauth_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_users_created_at" ON "public"."users" USING "btree" ("created_at");



CREATE INDEX "idx_users_real_debrid_id" ON "public"."users" USING "btree" ("real_debrid_id");



CREATE OR REPLACE TRIGGER "update_files_updated_at" BEFORE UPDATE ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_folders_updated_at" BEFORE UPDATE ON "public"."folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_oauth_tokens_updated_at_trigger" BEFORE UPDATE ON "public"."oauth_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_oauth_tokens_updated_at"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."file_folders"
    ADD CONSTRAINT "file_folders_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_folders"
    ADD CONSTRAINT "file_folders_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own file folders" ON "public"."file_folders" FOR DELETE USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "files"."user_id"
           FROM "public"."files"
          WHERE ("files"."id" = "file_folders"."file_id")))))::"text"));



CREATE POLICY "Users can delete own files" ON "public"."files" FOR DELETE USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "files"."user_id")))::"text"));



CREATE POLICY "Users can delete own folders" ON "public"."folders" FOR DELETE USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "folders"."user_id")))::"text"));



CREATE POLICY "Users can delete own profile" ON "public"."users" FOR DELETE USING ((("auth"."uid"())::"text" = ("real_debrid_id")::"text"));



CREATE POLICY "Users can delete their own OAuth tokens" ON "public"."oauth_tokens" FOR DELETE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can insert own file folders" ON "public"."file_folders" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "files"."user_id"
           FROM "public"."files"
          WHERE ("files"."id" = "file_folders"."file_id")))))::"text"));



CREATE POLICY "Users can insert own files" ON "public"."files" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "files"."user_id")))::"text"));



CREATE POLICY "Users can insert own folders" ON "public"."folders" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "folders"."user_id")))::"text"));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("real_debrid_id")::"text"));



CREATE POLICY "Users can insert their own OAuth tokens" ON "public"."oauth_tokens" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can update own files" ON "public"."files" FOR UPDATE USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "files"."user_id")))::"text"));



CREATE POLICY "Users can update own folders" ON "public"."folders" FOR UPDATE USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "folders"."user_id")))::"text"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING ((("auth"."uid"())::"text" = ("real_debrid_id")::"text"));



CREATE POLICY "Users can update their own OAuth tokens" ON "public"."oauth_tokens" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view own file folders" ON "public"."file_folders" FOR SELECT USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "files"."user_id"
           FROM "public"."files"
          WHERE ("files"."id" = "file_folders"."file_id")))))::"text"));



CREATE POLICY "Users can view own files" ON "public"."files" FOR SELECT USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "files"."user_id")))::"text"));



CREATE POLICY "Users can view own folders" ON "public"."folders" FOR SELECT USING ((("auth"."uid"())::"text" = (( SELECT "users"."real_debrid_id"
   FROM "public"."users"
  WHERE ("users"."id" = "folders"."user_id")))::"text"));



CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT USING ((("auth"."uid"())::"text" = ("real_debrid_id")::"text"));



CREATE POLICY "Users can view their own OAuth tokens" ON "public"."oauth_tokens" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



ALTER TABLE "public"."file_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."update_oauth_tokens_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_oauth_tokens_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_oauth_tokens_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."file_folders" TO "anon";
GRANT ALL ON TABLE "public"."file_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."file_folders" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."folders" TO "anon";
GRANT ALL ON TABLE "public"."folders" TO "authenticated";
GRANT ALL ON TABLE "public"."folders" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_tokens" TO "anon";
GRANT ALL ON TABLE "public"."oauth_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































