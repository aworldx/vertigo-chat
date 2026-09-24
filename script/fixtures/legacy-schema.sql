-- Test-only baseline of the Phoenix-owned schema. No application rows or secrets.
-- Go migration compatibility is exercised against this snapshot in coverage CI.
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.6 (Homebrew)
-- Dumped by pg_dump version 15.6 (Homebrew)

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

--
-- Name: create_profile_for_registered_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_for_registered_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO profiles (user_id, inserted_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: emoji_tags_update_search_document(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emoji_tags_update_search_document() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_document := to_tsvector('russian', NEW.name || ' ' || array_to_string(NEW.triggers, ' '));
  RETURN NEW;
END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bot_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_conversations (
    id bigint NOT NULL,
    subject_key character varying(255) NOT NULL,
    nickname character varying(255) NOT NULL,
    registered boolean DEFAULT false NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    exchange_count integer DEFAULT 0 NOT NULL,
    last_interaction_at timestamp without time zone,
    user_id bigint,
    inserted_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: bot_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_conversations_id_seq OWNED BY public.bot_conversations.id;


--
-- Name: bot_daily_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_daily_usages (
    id bigint NOT NULL,
    usage_date date NOT NULL,
    input_tokens bigint DEFAULT 0 NOT NULL,
    output_tokens bigint DEFAULT 0 NOT NULL,
    total_tokens bigint DEFAULT 0 NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    inserted_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: bot_daily_usages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_daily_usages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_daily_usages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_daily_usages_id_seq OWNED BY public.bot_daily_usages.id;


--
-- Name: bot_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_messages (
    id bigint NOT NULL,
    role character varying(255) NOT NULL,
    body text NOT NULL,
    conversation_id bigint NOT NULL,
    inserted_at timestamp without time zone NOT NULL
);


--
-- Name: bot_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_messages_id_seq OWNED BY public.bot_messages.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid NOT NULL,
    room_id character varying(255) NOT NULL,
    identity_key character varying(255) NOT NULL,
    nickname character varying(255) NOT NULL,
    resume_secret_hash character varying(255) NOT NULL,
    status character varying(255) NOT NULL,
    last_seen_at timestamp(0) without time zone NOT NULL,
    reconnect_deadline_at timestamp(0) without time zone,
    ended_at timestamp(0) without time zone,
    generation bigint DEFAULT 0 NOT NULL,
    visit_id bigint,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    last_visibility character varying(255) DEFAULT 'unknown'::character varying NOT NULL
);


--
-- Name: checkers_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkers_games (
    id bigint NOT NULL,
    inviter_id bigint NOT NULL,
    opponent_id bigint NOT NULL,
    white_id bigint,
    winner_id bigint,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    board jsonb DEFAULT '{}'::jsonb NOT NULL,
    turn character varying(255) DEFAULT 'white'::character varying NOT NULL,
    forced_from character varying(255),
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    CONSTRAINT different_checkers_players CHECK ((inviter_id <> opponent_id)),
    CONSTRAINT valid_checkers_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'finished'::character varying, 'declined'::character varying])::text[]))),
    CONSTRAINT valid_checkers_turn CHECK (((turn)::text = ANY ((ARRAY['white'::character varying, 'black'::character varying])::text[])))
);


--
-- Name: checkers_games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checkers_games_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checkers_games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checkers_games_id_seq OWNED BY public.checkers_games.id;


--
-- Name: emoji_tag_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emoji_tag_assignments (
    emoji_id bigint NOT NULL,
    emoji_tag_id bigint NOT NULL
);


--
-- Name: emoji_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emoji_tags (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    triggers character varying(255)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    search_document tsvector
);


--
-- Name: emoji_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emoji_tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emoji_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emoji_tags_id_seq OWNED BY public.emoji_tags.id;


--
-- Name: emojis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emojis (
    id bigint NOT NULL,
    code character varying(255) NOT NULL,
    image bytea,
    content_type character varying(255) NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    user_id bigint,
    status character varying(255) DEFAULT 'approved'::character varying NOT NULL,
    tags character varying(255)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    width integer,
    height integer,
    animated boolean DEFAULT false NOT NULL,
    rejection_reason text,
    image_key character varying(255)
);


--
-- Name: emojis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emojis_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emojis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emojis_id_seq OWNED BY public.emojis.id;


--
-- Name: feedback_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_entries (
    id bigint NOT NULL,
    user_id bigint,
    name character varying(255) NOT NULL,
    body text NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: feedback_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feedback_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feedback_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feedback_entries_id_seq OWNED BY public.feedback_entries.id;


--
-- Name: gallery_photo_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_photo_likes (
    id bigint NOT NULL,
    photo_id bigint NOT NULL,
    user_id bigint NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: gallery_photo_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gallery_photo_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gallery_photo_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gallery_photo_likes_id_seq OWNED BY public.gallery_photo_likes.id;


--
-- Name: gallery_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_photos (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    image bytea,
    content_type character varying(255) NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    caption character varying(280),
    thumbnail bytea,
    thumbnail_content_type character varying(255),
    image_key text,
    thumbnail_key text,
    CONSTRAINT gallery_media_required CHECK (((image IS NOT NULL) OR (image_key IS NOT NULL)))
);


--
-- Name: gallery_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gallery_photos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gallery_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gallery_photos_id_seq OWNED BY public.gallery_photos.id;


--
-- Name: game_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_players (
    id bigint NOT NULL,
    game_id bigint NOT NULL,
    user_id bigint NOT NULL,
    "position" integer NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: game_players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_players_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_players_id_seq OWNED BY public.game_players.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id bigint NOT NULL,
    kind character varying(255) NOT NULL,
    creator_id bigint NOT NULL,
    winner_id bigint,
    status character varying(255) DEFAULT 'waiting'::character varying NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    CONSTRAINT valid_game_kind CHECK (((kind)::text = ANY ((ARRAY['battleship'::character varying, 'durak'::character varying, 'balda'::character varying])::text[]))),
    CONSTRAINT valid_game_status CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'active'::character varying, 'finished'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.games_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: karmik_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.karmik_assessments (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    room_message_id bigint NOT NULL,
    delta integer NOT NULL,
    assessed_on date NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    chatlan_nickname character varying(255),
    message_body text,
    verdict character varying(255),
    reason character varying(255)
);


--
-- Name: karmik_assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.karmik_assessments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: karmik_assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.karmik_assessments_id_seq OWNED BY public.karmik_assessments.id;


--
-- Name: library_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_articles (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    series character varying(255),
    part_number integer,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: library_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_articles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_articles_id_seq OWNED BY public.library_articles.id;


--
-- Name: music_chart_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.music_chart_comments (
    id bigint NOT NULL,
    track_id bigint NOT NULL,
    user_id bigint NOT NULL,
    body character varying(255) NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: music_chart_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.music_chart_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: music_chart_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.music_chart_comments_id_seq OWNED BY public.music_chart_comments.id;


--
-- Name: music_chart_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.music_chart_likes (
    id bigint NOT NULL,
    track_id bigint NOT NULL,
    user_id bigint NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: music_chart_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.music_chart_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: music_chart_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.music_chart_likes_id_seq OWNED BY public.music_chart_likes.id;


--
-- Name: music_chart_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.music_chart_tracks (
    id bigint NOT NULL,
    title character varying(255) NOT NULL,
    audio bytea,
    content_type character varying(255) NOT NULL,
    user_id bigint NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    audio_key text,
    CONSTRAINT track_media_required CHECK (((audio IS NOT NULL) OR (audio_key IS NOT NULL)))
);


--
-- Name: music_chart_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.music_chart_tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: music_chart_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.music_chart_tracks_id_seq OWNED BY public.music_chart_tracks.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(255),
    birth_date date,
    gender character varying(255),
    about text,
    photo bytea,
    photo_content_type character varying(255),
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    photo_key text,
    thumbnail bytea,
    thumbnail_key text,
    thumbnail_content_type character varying(255)
);


--
-- Name: profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profiles_id_seq OWNED BY public.profiles.id;


--
-- Name: registered_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registered_users (
    id bigint NOT NULL,
    nickname character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    theme_id character varying(255) DEFAULT 'vertigo'::character varying NOT NULL,
    appearance jsonb DEFAULT '{}'::jsonb NOT NULL,
    public_message_count integer DEFAULT 0 NOT NULL,
    chat_seconds integer DEFAULT 0 NOT NULL,
    font_id character varying(255) DEFAULT 'theme'::character varying NOT NULL,
    font_style character varying(255) DEFAULT 'normal'::character varying NOT NULL,
    message_sound_enabled boolean DEFAULT false NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    is_game_guest boolean DEFAULT false NOT NULL,
    game_nickname character varying(255),
    guest_identity_id uuid,
    karma integer DEFAULT 0 NOT NULL,
    can_moderate_emojis boolean DEFAULT false NOT NULL,
    email character varying(255)
);


--
-- Name: registered_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registered_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registered_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registered_users_id_seq OWNED BY public.registered_users.id;


--
-- Name: room_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_messages (
    id bigint NOT NULL,
    room_id character varying(255) NOT NULL,
    kind character varying(255) NOT NULL,
    author character varying(255) NOT NULL,
    body text NOT NULL,
    recipient character varying(255),
    theme_id character varying(255) NOT NULL,
    appearance jsonb DEFAULT '{}'::jsonb NOT NULL,
    rank jsonb,
    reactions jsonb DEFAULT '{}'::jsonb NOT NULL,
    sent_at timestamp(0) without time zone NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    media_url text,
    media_artist character varying(255),
    media_duration character varying(255),
    media_source_url text,
    font_id character varying(255) DEFAULT 'theme'::character varying NOT NULL,
    font_style character varying(255) DEFAULT 'normal'::character varying NOT NULL,
    client_id character varying(255),
    author_identity character varying(255)
);


--
-- Name: room_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_messages_id_seq OWNED BY public.room_messages.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: security_registration_guards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_registration_guards (
    id bigint NOT NULL,
    fingerprint character varying(255) NOT NULL,
    day date NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: security_registration_guards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_registration_guards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_registration_guards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_registration_guards_id_seq OWNED BY public.security_registration_guards.id;


--
-- Name: visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visits (
    id bigint NOT NULL,
    nickname character varying(255) NOT NULL,
    entered_at timestamp(0) without time zone NOT NULL,
    left_at timestamp(0) without time zone,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    user_id bigint,
    session_id character varying(255),
    identity_key character varying(255) NOT NULL
);


--
-- Name: visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visits_id_seq OWNED BY public.visits.id;


--
-- Name: bot_conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_conversations ALTER COLUMN id SET DEFAULT nextval('public.bot_conversations_id_seq'::regclass);


--
-- Name: bot_daily_usages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_daily_usages ALTER COLUMN id SET DEFAULT nextval('public.bot_daily_usages_id_seq'::regclass);


--
-- Name: bot_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_messages ALTER COLUMN id SET DEFAULT nextval('public.bot_messages_id_seq'::regclass);


--
-- Name: checkers_games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkers_games ALTER COLUMN id SET DEFAULT nextval('public.checkers_games_id_seq'::regclass);


--
-- Name: emoji_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emoji_tags ALTER COLUMN id SET DEFAULT nextval('public.emoji_tags_id_seq'::regclass);


--
-- Name: emojis id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emojis ALTER COLUMN id SET DEFAULT nextval('public.emojis_id_seq'::regclass);


--
-- Name: feedback_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_entries ALTER COLUMN id SET DEFAULT nextval('public.feedback_entries_id_seq'::regclass);


--
-- Name: gallery_photo_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photo_likes ALTER COLUMN id SET DEFAULT nextval('public.gallery_photo_likes_id_seq'::regclass);


--
-- Name: gallery_photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photos ALTER COLUMN id SET DEFAULT nextval('public.gallery_photos_id_seq'::regclass);


--
-- Name: game_players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players ALTER COLUMN id SET DEFAULT nextval('public.game_players_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: karmik_assessments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.karmik_assessments ALTER COLUMN id SET DEFAULT nextval('public.karmik_assessments_id_seq'::regclass);


--
-- Name: library_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_articles ALTER COLUMN id SET DEFAULT nextval('public.library_articles_id_seq'::regclass);


--
-- Name: music_chart_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_comments ALTER COLUMN id SET DEFAULT nextval('public.music_chart_comments_id_seq'::regclass);


--
-- Name: music_chart_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_likes ALTER COLUMN id SET DEFAULT nextval('public.music_chart_likes_id_seq'::regclass);


--
-- Name: music_chart_tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_tracks ALTER COLUMN id SET DEFAULT nextval('public.music_chart_tracks_id_seq'::regclass);


--
-- Name: profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles ALTER COLUMN id SET DEFAULT nextval('public.profiles_id_seq'::regclass);


--
-- Name: registered_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registered_users ALTER COLUMN id SET DEFAULT nextval('public.registered_users_id_seq'::regclass);


--
-- Name: room_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_messages ALTER COLUMN id SET DEFAULT nextval('public.room_messages_id_seq'::regclass);


--
-- Name: security_registration_guards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_registration_guards ALTER COLUMN id SET DEFAULT nextval('public.security_registration_guards_id_seq'::regclass);


--
-- Name: visits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits ALTER COLUMN id SET DEFAULT nextval('public.visits_id_seq'::regclass);


--
-- Name: bot_conversations bot_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_conversations
    ADD CONSTRAINT bot_conversations_pkey PRIMARY KEY (id);


--
-- Name: bot_daily_usages bot_daily_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_daily_usages
    ADD CONSTRAINT bot_daily_usages_pkey PRIMARY KEY (id);


--
-- Name: bot_messages bot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_messages
    ADD CONSTRAINT bot_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: checkers_games checkers_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkers_games
    ADD CONSTRAINT checkers_games_pkey PRIMARY KEY (id);


--
-- Name: emoji_tags emoji_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emoji_tags
    ADD CONSTRAINT emoji_tags_pkey PRIMARY KEY (id);


--
-- Name: emojis emojis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emojis
    ADD CONSTRAINT emojis_pkey PRIMARY KEY (id);


--
-- Name: feedback_entries feedback_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_entries
    ADD CONSTRAINT feedback_entries_pkey PRIMARY KEY (id);


--
-- Name: gallery_photo_likes gallery_photo_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photo_likes
    ADD CONSTRAINT gallery_photo_likes_pkey PRIMARY KEY (id);


--
-- Name: gallery_photos gallery_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photos
    ADD CONSTRAINT gallery_photos_pkey PRIMARY KEY (id);


--
-- Name: game_players game_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: karmik_assessments karmik_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.karmik_assessments
    ADD CONSTRAINT karmik_assessments_pkey PRIMARY KEY (id);


--
-- Name: library_articles library_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_articles
    ADD CONSTRAINT library_articles_pkey PRIMARY KEY (id);


--
-- Name: music_chart_comments music_chart_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_comments
    ADD CONSTRAINT music_chart_comments_pkey PRIMARY KEY (id);


--
-- Name: music_chart_likes music_chart_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_likes
    ADD CONSTRAINT music_chart_likes_pkey PRIMARY KEY (id);


--
-- Name: music_chart_tracks music_chart_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_tracks
    ADD CONSTRAINT music_chart_tracks_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: registered_users registered_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registered_users
    ADD CONSTRAINT registered_users_pkey PRIMARY KEY (id);


--
-- Name: room_messages room_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_messages
    ADD CONSTRAINT room_messages_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: security_registration_guards security_registration_guards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_registration_guards
    ADD CONSTRAINT security_registration_guards_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: bot_conversations_registered_last_interaction_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bot_conversations_registered_last_interaction_at_index ON public.bot_conversations USING btree (registered, last_interaction_at);


--
-- Name: bot_conversations_subject_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bot_conversations_subject_key_index ON public.bot_conversations USING btree (subject_key);


--
-- Name: bot_conversations_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bot_conversations_user_id_index ON public.bot_conversations USING btree (user_id);


--
-- Name: bot_daily_usages_usage_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bot_daily_usages_usage_date_index ON public.bot_daily_usages USING btree (usage_date);


--
-- Name: bot_messages_conversation_id_inserted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bot_messages_conversation_id_inserted_at_index ON public.bot_messages USING btree (conversation_id, inserted_at);


--
-- Name: chat_sessions_active_room_identity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_sessions_active_room_identity_index ON public.chat_sessions USING btree (room_id, identity_key) WHERE ((status)::text = ANY ((ARRAY['active'::character varying, 'reconnecting'::character varying])::text[]));


--
-- Name: chat_sessions_active_room_nickname_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_sessions_active_room_nickname_index ON public.chat_sessions USING btree (room_id, nickname) WHERE ((status)::text = ANY ((ARRAY['active'::character varying, 'reconnecting'::character varying])::text[]));


--
-- Name: chat_sessions_last_seen_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_sessions_last_seen_at_index ON public.chat_sessions USING btree (last_seen_at) WHERE ((status)::text = 'active'::text);


--
-- Name: chat_sessions_room_id_identity_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_sessions_room_id_identity_key_index ON public.chat_sessions USING btree (room_id, identity_key);


--
-- Name: chat_sessions_status_reconnect_deadline_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_sessions_status_reconnect_deadline_at_index ON public.chat_sessions USING btree (status, reconnect_deadline_at);


--
-- Name: checkers_games_inviter_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkers_games_inviter_id_index ON public.checkers_games USING btree (inviter_id);


--
-- Name: checkers_games_opponent_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkers_games_opponent_id_index ON public.checkers_games USING btree (opponent_id);


--
-- Name: checkers_games_winner_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkers_games_winner_id_index ON public.checkers_games USING btree (winner_id);


--
-- Name: emoji_tag_assignments_emoji_id_emoji_tag_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX emoji_tag_assignments_emoji_id_emoji_tag_id_index ON public.emoji_tag_assignments USING btree (emoji_id, emoji_tag_id);


--
-- Name: emoji_tag_assignments_emoji_tag_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emoji_tag_assignments_emoji_tag_id_index ON public.emoji_tag_assignments USING btree (emoji_tag_id);


--
-- Name: emoji_tags_full_text_search_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emoji_tags_full_text_search_index ON public.emoji_tags USING gin (search_document);


--
-- Name: emoji_tags_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX emoji_tags_name_index ON public.emoji_tags USING btree (name);


--
-- Name: emojis_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX emojis_code_index ON public.emojis USING btree (code);


--
-- Name: emojis_image_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX emojis_image_key_index ON public.emojis USING btree (image_key) WHERE (image_key IS NOT NULL);


--
-- Name: emojis_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emojis_status_index ON public.emojis USING btree (status);


--
-- Name: emojis_tags_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emojis_tags_index ON public.emojis USING gin (tags);


--
-- Name: emojis_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emojis_user_id_index ON public.emojis USING btree (user_id);


--
-- Name: feedback_entries_inserted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_entries_inserted_at_index ON public.feedback_entries USING btree (inserted_at);


--
-- Name: feedback_entries_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_entries_user_id_index ON public.feedback_entries USING btree (user_id);


--
-- Name: gallery_photo_likes_photo_id_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gallery_photo_likes_photo_id_user_id_index ON public.gallery_photo_likes USING btree (photo_id, user_id);


--
-- Name: gallery_photo_likes_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gallery_photo_likes_user_id_index ON public.gallery_photo_likes USING btree (user_id);


--
-- Name: gallery_photos_inserted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gallery_photos_inserted_at_index ON public.gallery_photos USING btree (inserted_at);


--
-- Name: gallery_photos_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gallery_photos_user_id_index ON public.gallery_photos USING btree (user_id);


--
-- Name: game_players_game_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX game_players_game_id_position_index ON public.game_players USING btree (game_id, "position");


--
-- Name: game_players_game_id_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX game_players_game_id_user_id_index ON public.game_players USING btree (game_id, user_id);


--
-- Name: game_players_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_players_user_id_index ON public.game_players USING btree (user_id);


--
-- Name: games_creator_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX games_creator_id_index ON public.games USING btree (creator_id);


--
-- Name: games_kind_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX games_kind_status_index ON public.games USING btree (kind, status);


--
-- Name: games_winner_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX games_winner_id_index ON public.games USING btree (winner_id);


--
-- Name: karmik_assessments_assessed_on_inserted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX karmik_assessments_assessed_on_inserted_at_index ON public.karmik_assessments USING btree (assessed_on, inserted_at);


--
-- Name: karmik_assessments_user_id_assessed_on_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX karmik_assessments_user_id_assessed_on_index ON public.karmik_assessments USING btree (user_id, assessed_on);


--
-- Name: karmik_assessments_user_id_room_message_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX karmik_assessments_user_id_room_message_id_index ON public.karmik_assessments USING btree (user_id, room_message_id);


--
-- Name: library_articles_inserted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_articles_inserted_at_index ON public.library_articles USING btree (inserted_at);


--
-- Name: library_articles_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_articles_user_id_index ON public.library_articles USING btree (user_id);


--
-- Name: library_articles_user_id_series_part_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_articles_user_id_series_part_number_index ON public.library_articles USING btree (user_id, series, part_number);


--
-- Name: music_chart_comments_track_id_inserted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX music_chart_comments_track_id_inserted_at_index ON public.music_chart_comments USING btree (track_id, inserted_at);


--
-- Name: music_chart_comments_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX music_chart_comments_user_id_index ON public.music_chart_comments USING btree (user_id);


--
-- Name: music_chart_likes_track_id_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX music_chart_likes_track_id_user_id_index ON public.music_chart_likes USING btree (track_id, user_id);


--
-- Name: music_chart_likes_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX music_chart_likes_user_id_index ON public.music_chart_likes USING btree (user_id);


--
-- Name: music_chart_tracks_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX music_chart_tracks_user_id_index ON public.music_chart_tracks USING btree (user_id);


--
-- Name: profiles_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_user_id_index ON public.profiles USING btree (user_id);


--
-- Name: registered_users_guest_identity_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registered_users_guest_identity_id_index ON public.registered_users USING btree (guest_identity_id) WHERE (guest_identity_id IS NOT NULL);


--
-- Name: registered_users_is_game_guest_updated_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registered_users_is_game_guest_updated_at_index ON public.registered_users USING btree (is_game_guest, updated_at);


--
-- Name: registered_users_lower_email_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registered_users_lower_email_index ON public.registered_users USING btree (lower((email)::text)) WHERE (email IS NOT NULL);


--
-- Name: registered_users_nickname_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registered_users_nickname_index ON public.registered_users USING btree (nickname);


--
-- Name: room_messages_outbox_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX room_messages_outbox_id_index ON public.room_messages USING btree (room_id, author_identity, client_id);


--
-- Name: room_messages_room_id_sent_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_messages_room_id_sent_at_index ON public.room_messages USING btree (room_id, sent_at);


--
-- Name: security_registration_guards_day_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_registration_guards_day_index ON public.security_registration_guards USING btree (day);


--
-- Name: security_registration_guards_fingerprint_day_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX security_registration_guards_fingerprint_day_index ON public.security_registration_guards USING btree (fingerprint, day);


--
-- Name: visits_active_identity_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visits_active_identity_key_index ON public.visits USING btree (identity_key) WHERE (left_at IS NULL);


--
-- Name: visits_active_session_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visits_active_session_id_index ON public.visits USING btree (session_id) WHERE ((left_at IS NULL) AND (session_id IS NOT NULL));


--
-- Name: visits_entered_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visits_entered_at_index ON public.visits USING btree (entered_at);


--
-- Name: visits_nickname_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visits_nickname_index ON public.visits USING btree (nickname);


--
-- Name: visits_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visits_user_id_index ON public.visits USING btree (user_id);


--
-- Name: registered_users create_profile_for_registered_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_profile_for_registered_user AFTER INSERT ON public.registered_users FOR EACH ROW WHEN ((new.is_game_guest = false)) EXECUTE FUNCTION public.create_profile_for_registered_user();


--
-- Name: emoji_tags emoji_tags_search_document_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER emoji_tags_search_document_trigger BEFORE INSERT OR UPDATE OF name, triggers ON public.emoji_tags FOR EACH ROW EXECUTE FUNCTION public.emoji_tags_update_search_document();


--
-- Name: bot_conversations bot_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_conversations
    ADD CONSTRAINT bot_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: bot_messages bot_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_messages
    ADD CONSTRAINT bot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.bot_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL;


--
-- Name: checkers_games checkers_games_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkers_games
    ADD CONSTRAINT checkers_games_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: checkers_games checkers_games_opponent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkers_games
    ADD CONSTRAINT checkers_games_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: checkers_games checkers_games_white_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkers_games
    ADD CONSTRAINT checkers_games_white_id_fkey FOREIGN KEY (white_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: checkers_games checkers_games_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkers_games
    ADD CONSTRAINT checkers_games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.registered_users(id) ON DELETE SET NULL;


--
-- Name: emoji_tag_assignments emoji_tag_assignments_emoji_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emoji_tag_assignments
    ADD CONSTRAINT emoji_tag_assignments_emoji_id_fkey FOREIGN KEY (emoji_id) REFERENCES public.emojis(id) ON DELETE CASCADE;


--
-- Name: emoji_tag_assignments emoji_tag_assignments_emoji_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emoji_tag_assignments
    ADD CONSTRAINT emoji_tag_assignments_emoji_tag_id_fkey FOREIGN KEY (emoji_tag_id) REFERENCES public.emoji_tags(id) ON DELETE CASCADE;


--
-- Name: emojis emojis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emojis
    ADD CONSTRAINT emojis_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE SET NULL;


--
-- Name: feedback_entries feedback_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_entries
    ADD CONSTRAINT feedback_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE SET NULL;


--
-- Name: gallery_photo_likes gallery_photo_likes_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photo_likes
    ADD CONSTRAINT gallery_photo_likes_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.gallery_photos(id) ON DELETE CASCADE;


--
-- Name: gallery_photo_likes gallery_photo_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photo_likes
    ADD CONSTRAINT gallery_photo_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: gallery_photos gallery_photos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_photos
    ADD CONSTRAINT gallery_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: game_players game_players_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: game_players game_players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: games games_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: games games_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.registered_users(id) ON DELETE SET NULL;


--
-- Name: karmik_assessments karmik_assessments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.karmik_assessments
    ADD CONSTRAINT karmik_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: library_articles library_articles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_articles
    ADD CONSTRAINT library_articles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: music_chart_comments music_chart_comments_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_comments
    ADD CONSTRAINT music_chart_comments_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.music_chart_tracks(id) ON DELETE CASCADE;


--
-- Name: music_chart_comments music_chart_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_comments
    ADD CONSTRAINT music_chart_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: music_chart_likes music_chart_likes_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_likes
    ADD CONSTRAINT music_chart_likes_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.music_chart_tracks(id) ON DELETE CASCADE;


--
-- Name: music_chart_likes music_chart_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_likes
    ADD CONSTRAINT music_chart_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: music_chart_tracks music_chart_tracks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.music_chart_tracks
    ADD CONSTRAINT music_chart_tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE CASCADE;


--
-- Name: visits visits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.registered_users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--
