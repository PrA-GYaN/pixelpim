--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Attribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Attribute" (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "defaultValue" text,
    "userId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Attribute" OWNER TO postgres;

--
-- Name: AttributeGroup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AttributeGroup" (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    "userId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AttributeGroup" OWNER TO postgres;

--
-- Name: AttributeGroupAttribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AttributeGroupAttribute" (
    id integer NOT NULL,
    "attributeId" integer NOT NULL,
    "attributeGroupId" integer NOT NULL,
    required boolean DEFAULT false NOT NULL,
    "defaultValue" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AttributeGroupAttribute" OWNER TO postgres;

--
-- Name: AttributeGroupAttribute_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AttributeGroupAttribute_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AttributeGroupAttribute_id_seq" OWNER TO postgres;

--
-- Name: AttributeGroupAttribute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AttributeGroupAttribute_id_seq" OWNED BY public."AttributeGroupAttribute".id;


--
-- Name: AttributeGroup_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AttributeGroup_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AttributeGroup_id_seq" OWNER TO postgres;

--
-- Name: AttributeGroup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AttributeGroup_id_seq" OWNED BY public."AttributeGroup".id;


--
-- Name: Attribute_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Attribute_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Attribute_id_seq" OWNER TO postgres;

--
-- Name: Attribute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Attribute_id_seq" OWNED BY public."Attribute".id;


--
-- Name: Family; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Family" (
    id integer NOT NULL,
    name text NOT NULL,
    "userId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Family" OWNER TO postgres;

--
-- Name: FamilyAttribute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FamilyAttribute" (
    id integer NOT NULL,
    "familyId" integer NOT NULL,
    "attributeId" integer NOT NULL,
    "isRequired" boolean DEFAULT false NOT NULL,
    "additionalValue" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FamilyAttribute" OWNER TO postgres;

--
-- Name: FamilyAttribute_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."FamilyAttribute_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."FamilyAttribute_id_seq" OWNER TO postgres;

--
-- Name: FamilyAttribute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."FamilyAttribute_id_seq" OWNED BY public."FamilyAttribute".id;


--
-- Name: Family_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Family_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Family_id_seq" OWNER TO postgres;

--
-- Name: Family_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Family_id_seq" OWNED BY public."Family".id;


--
-- Name: Otp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Otp" (
    id integer NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Otp" OWNER TO postgres;

--
-- Name: Otp_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Otp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Otp_id_seq" OWNER TO postgres;

--
-- Name: Otp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Otp_id_seq" OWNED BY public."Otp".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    fullname text,
    password text,
    "googleId" text,
    provider text DEFAULT 'local'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: Attribute id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attribute" ALTER COLUMN id SET DEFAULT nextval('public."Attribute_id_seq"'::regclass);


--
-- Name: AttributeGroup id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroup" ALTER COLUMN id SET DEFAULT nextval('public."AttributeGroup_id_seq"'::regclass);


--
-- Name: AttributeGroupAttribute id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroupAttribute" ALTER COLUMN id SET DEFAULT nextval('public."AttributeGroupAttribute_id_seq"'::regclass);


--
-- Name: Family id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Family" ALTER COLUMN id SET DEFAULT nextval('public."Family_id_seq"'::regclass);


--
-- Name: FamilyAttribute id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FamilyAttribute" ALTER COLUMN id SET DEFAULT nextval('public."FamilyAttribute_id_seq"'::regclass);


--
-- Name: Otp id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Otp" ALTER COLUMN id SET DEFAULT nextval('public."Otp_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Attribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Attribute" (id, name, type, "defaultValue", "userId", "createdAt", "updatedAt") FROM stdin;
4	test1	INTEGER	0	1	2025-08-12 10:33:11.99	2025-08-12 10:33:11.99
6	tes1t1	INTEGER	1	1	2025-08-12 10:45:54.167	2025-08-12 10:45:54.167
8	tes1t111	STRING	1	1	2025-08-12 10:47:19.748	2025-08-12 10:47:19.748
9	te1s1t111	INTEGER	0	1	2025-08-12 10:47:39.559	2025-08-12 10:47:39.559
\.


--
-- Data for Name: AttributeGroup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AttributeGroup" (id, name, description, "userId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AttributeGroupAttribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AttributeGroupAttribute" (id, "attributeId", "attributeGroupId", required, "defaultValue", "createdAt") FROM stdin;
\.


--
-- Data for Name: Family; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Family" (id, name, "userId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: FamilyAttribute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FamilyAttribute" (id, "familyId", "attributeId", "isRequired", "additionalValue", "createdAt") FROM stdin;
\.


--
-- Data for Name: Otp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Otp" (id, email, code, type, verified, "expiresAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, fullname, password, "googleId", provider, "createdAt") FROM stdin;
1	pragyan1516@gmail.com	Pragyan Kc	$2b$10$a.m.TBKSKMOT8tfbgCFIpOl6j9W.9YuZEZnIhKjrm1tFKwSkr.Qy.	\N	local	2025-08-12 10:23:26.208
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
2e4670e0-f654-48af-9315-fda3a55ac361	ac0ce5967864e3352da88331e3b3f8a5caa1983b0868428c695f3c9d655b27b1	2025-08-12 14:48:40.565582+05:45	20250812090340_init	\N	\N	2025-08-12 14:48:40.2233+05:45	1
96ce6687-5b1c-4553-a122-97d9c4d305d2	056f86d2ab361336f7be9e37a261cf35e23374c997a02920c5b29293c80c1d17	\N	20250812100600_add_attribute_type_enum	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20250812100600_add_attribute_type_enum\n\nDatabase error code: 42804\n\nDatabase error:\nERROR: column "defaultValue" cannot be cast automatically to type jsonb\nHINT: You might need to specify "USING "defaultValue"::jsonb".\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42804), message: "column \\"defaultValue\\" cannot be cast automatically to type jsonb", detail: None, hint: Some("You might need to specify \\"USING \\"defaultValue\\"::jsonb\\"."), position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(12900), routine: Some("ATPrepAlterColumnType") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20250812100600_add_attribute_type_enum"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20250812100600_add_attribute_type_enum"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:236	\N	2025-08-12 15:56:23.230596+05:45	0
\.


--
-- Name: AttributeGroupAttribute_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AttributeGroupAttribute_id_seq"', 1, false);


--
-- Name: AttributeGroup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AttributeGroup_id_seq"', 1, false);


--
-- Name: Attribute_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Attribute_id_seq"', 9, true);


--
-- Name: FamilyAttribute_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."FamilyAttribute_id_seq"', 1, false);


--
-- Name: Family_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Family_id_seq"', 1, false);


--
-- Name: Otp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Otp_id_seq"', 1, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 1, true);


--
-- Name: AttributeGroupAttribute AttributeGroupAttribute_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroupAttribute"
    ADD CONSTRAINT "AttributeGroupAttribute_pkey" PRIMARY KEY (id);


--
-- Name: AttributeGroup AttributeGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroup"
    ADD CONSTRAINT "AttributeGroup_pkey" PRIMARY KEY (id);


--
-- Name: Attribute Attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attribute"
    ADD CONSTRAINT "Attribute_pkey" PRIMARY KEY (id);


--
-- Name: FamilyAttribute FamilyAttribute_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FamilyAttribute"
    ADD CONSTRAINT "FamilyAttribute_pkey" PRIMARY KEY (id);


--
-- Name: Family Family_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Family"
    ADD CONSTRAINT "Family_pkey" PRIMARY KEY (id);


--
-- Name: Otp Otp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Otp"
    ADD CONSTRAINT "Otp_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AttributeGroupAttribute_attributeId_attributeGroupId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AttributeGroupAttribute_attributeId_attributeGroupId_key" ON public."AttributeGroupAttribute" USING btree ("attributeId", "attributeGroupId");


--
-- Name: AttributeGroup_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AttributeGroup_name_key" ON public."AttributeGroup" USING btree (name);


--
-- Name: Attribute_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Attribute_name_key" ON public."Attribute" USING btree (name);


--
-- Name: FamilyAttribute_familyId_attributeId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "FamilyAttribute_familyId_attributeId_key" ON public."FamilyAttribute" USING btree ("familyId", "attributeId");


--
-- Name: Family_name_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Family_name_userId_key" ON public."Family" USING btree (name, "userId");


--
-- Name: Otp_email_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_email_type_idx" ON public."Otp" USING btree (email, type);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_googleId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_googleId_key" ON public."User" USING btree ("googleId");


--
-- Name: AttributeGroupAttribute AttributeGroupAttribute_attributeGroupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroupAttribute"
    ADD CONSTRAINT "AttributeGroupAttribute_attributeGroupId_fkey" FOREIGN KEY ("attributeGroupId") REFERENCES public."AttributeGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AttributeGroupAttribute AttributeGroupAttribute_attributeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroupAttribute"
    ADD CONSTRAINT "AttributeGroupAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES public."Attribute"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AttributeGroup AttributeGroup_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AttributeGroup"
    ADD CONSTRAINT "AttributeGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attribute Attribute_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attribute"
    ADD CONSTRAINT "Attribute_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FamilyAttribute FamilyAttribute_attributeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FamilyAttribute"
    ADD CONSTRAINT "FamilyAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES public."Attribute"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FamilyAttribute FamilyAttribute_familyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FamilyAttribute"
    ADD CONSTRAINT "FamilyAttribute_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES public."Family"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Family Family_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Family"
    ADD CONSTRAINT "Family_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

