# Apoyo

App URL: https://app.heyapoyo.com
No local builds, all files are updated through the Github browser.

**Note:** This project uses the `gpt-5-nano` model via a custom `openai.responses.create` endpoint. Do not replace this with older models like `gpt-4o-mini` as it relies on specific formatting.

---

## Supabase Initialization

Run the following complete SQL script in your Supabase SQL Editor. It includes all necessary extensions, tables, storage buckets, functions, and Row Level Security (RLS) policies required for the app to function.

```sql
-- 1. Enable Vector Extension (Required for embeddings)
create extension if not exists vector;

-- 2. Create Tables
create table public.bot_config (
  space_id text not null,
  system_prompt text not null default 'You are a helpful, knowledgeable, and professional customer support assistant. Your primary goal is to assist users by providing accurate and concise answers based on the provided documentation. Maintain a friendly and empathetic tone at all times.'::text,
  user_id uuid not null,
  primary_color text null default '#000000'::text,
  header_text text null default 'Documentation Bot'::text,
  welcome_message text null default 'How can I help you today?'::text,
  bot_avatar text null,
  remove_branding boolean null default false,
  show_prompts boolean null default true,
  suggested_prompts jsonb null default '["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"]'::jsonb,
  lead_capture_enabled boolean null default false,
  agents_online boolean null default false,
  canned_responses jsonb null default '[]'::jsonb,
  language text null default 'Auto-detect'::text,
  temperature numeric null default 0.5,
  match_threshold numeric null default 0.5,
  reasoning_effort text null default 'medium'::text,
  verbosity text null default 'medium'::text,
  allowed_domains text null,
  page_context_enabled boolean null default false,
  routing_config jsonb null default '[]'::jsonb,
  workspace_name text null default 'My Workspace'::text,
  timezone text null default 'UTC'::text,
  follow_up_questions_enabled boolean null default false,
  description_text text null,
  input_placeholder text null default 'Ask a question...'::text,
  bot_font_color text null default '#1f2937'::text,
  user_font_color text null default '#ffffff'::text,
  agent_bubble_color text null default '#f3f4f6'::text,
  user_bubble_color text null default '#000000'::text,
  launcher_color text null default '#000000'::text,
  launcher_icon_color text null default '#ffffff'::text,
  tabs_enabled boolean null default false,
  help_search_placeholder text null default 'Search articles...'::text,
  greeting_title text null default 'Hello there.'::text,
  greeting_body text null default 'How can we help?'::text,
  home_tab_enabled boolean null default false,
  home_content text null,
  plan text null default 'free'::text,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  help_center_color text null,
  help_center_bg_image text null,
  constraint bot_config_pkey primary key (user_id),
  constraint bot_config_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint unique_space_id unique (space_id)
) TABLESPACE pg_default;

create table public.profiles (
  id uuid not null,
  first_name text null,
  last_name text null,
  email text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.help_center_articles (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  category text null default 'General'::text,
  slug text null,
  seo_title text null,
  seo_description text null,
  status text null default 'published'::text,
  views integer null default 0,
  upvotes integer null default 0,
  neutral_votes integer null default 0,
  downvotes integer null default 0,
  tags jsonb null default '[]'::jsonb,
  related_articles jsonb null default '[]'::jsonb,
  visibility text null default 'public'::text,
  scheduled_at timestamp with time zone null,
  constraint help_center_articles_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_help_center_articles_space_id on public.help_center_articles using btree (space_id) TABLESPACE pg_default;
create index IF not exists idx_help_center_articles_slug on public.help_center_articles using btree (slug) TABLESPACE pg_default;

create table public.proactive_triggers (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  url_match text not null,
  delay_seconds integer not null default 10,
  message text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint proactive_triggers_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_triggers_space_id on public.proactive_triggers using btree (space_id) TABLESPACE pg_default;

create table public.data_sources (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  type text not null,
  source_uri text null,
  credentials jsonb null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  status text null default 'active'::text,
  constraint data_sources_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_data_sources_space_id on public.data_sources using btree (space_id) TABLESPACE pg_default;

create table public.faqs (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  question text not null,
  answer text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint faqs_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_faqs_space_id on public.faqs using btree (space_id) TABLESPACE pg_default;

create table public.knowledge_documents (
  id bigserial not null,
  page_url text not null,
  content text not null,
  embedding public.vector(1536) null,
  space_id text null,
  source_type text null default 'gitbook'::text,
  data_source_id uuid null,
  constraint knowledge_documents_pkey primary key (id),
  constraint knowledge_documents_data_source_id_fkey foreign KEY (data_source_id) references data_sources (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.workspace_integrations (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  provider text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint workspace_integrations_pkey primary key (id),
  constraint workspace_integrations_space_id_provider_key unique (space_id, provider)
) TABLESPACE pg_default;

create index IF not exists idx_integrations_space_id on public.workspace_integrations using btree (space_id) TABLESPACE pg_default;

create table public.team_members (
  id bigserial not null,
  space_id text not null,
  email text not null,
  role text null default 'agent'::text,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint team_members_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_team_members_space_id on public.team_members using btree (space_id) TABLESPACE pg_default;
create index IF not exists idx_team_members_email on public.team_members using btree (email) TABLESPACE pg_default;

create table public.space_insights (
  id bigserial not null,
  space_id text not null,
  insights text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint space_insights_pkey primary key (id)
) TABLESPACE pg_default;

create table public.chat_feedback (
  id bigserial primary key,
  space_id text not null,
  message_id text not null,
  prompt text not null,
  response text not null,
  rating text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint chat_feedback_space_id_message_id_key unique (space_id, message_id)
) TABLESPACE pg_default;

create table public.bot_messages (
  id bigserial primary key,
  space_id text not null,
  role text not null,
  content text not null,
  sentiment_score numeric null,
  created_at timestamp with time zone default timezone('utc'::text, now())
) TABLESPACE pg_default;

create table public.leads (
  id bigserial not null,
  space_id text not null,
  name text not null,
  email text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint leads_pkey primary key (id)
) TABLESPACE pg_default;

create table public.tickets (
  id bigserial not null,
  space_id text not null,
  prompt text not null,
  email text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint tickets_pkey primary key (id)
) TABLESPACE pg_default;

create table public.live_sessions (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  email text not null,
  status text null default 'open'::text,
  history text null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  slack_thread_ts text null,
  resolution_time integer null,
  constraint live_sessions_pkey primary key (id)
) TABLESPACE pg_default;

create table public.live_messages (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  sentiment_score numeric null,
  constraint live_messages_pkey primary key (id),
  constraint live_messages_session_id_fkey foreign KEY (session_id) references live_sessions (id) on delete CASCADE
) TABLESPACE pg_default;

-- 3. Stored Procedures / Functions
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_space_id text
)
returns table (
  id bigint,
  space_id text,
  page_url text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    knowledge_documents.id,
    knowledge_documents.space_id,
    knowledge_documents.page_url,
    knowledge_documents.content,
    1 - (knowledge_documents.embedding <=> query_embedding) as similarity
  from knowledge_documents
  where 1 - (knowledge_documents.embedding <=> query_embedding) > match_threshold
    and knowledge_documents.space_id = p_space_id
  order by knowledge_documents.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function set_agents_online(p_space_id text, p_online boolean)
returns void
language sql
security definer
as $$
  update public.bot_config set agents_online = p_online where space_id = p_space_id;
$$;

create or replace function set_canned_responses(p_space_id text, p_responses jsonb)
returns void
language sql
security definer
as $$
  update public.bot_config set canned_responses = p_responses where space_id = p_space_id;
$$;

-- 4. Storage Buckets & Policies
insert into storage.buckets (id, name, public, file_size_limit) values 
('chat_attachments', 'chat_attachments', true, 2097152),
('article_images', 'article_images', true, 5242880),
('bot_avatars', 'bot_avatars', true, 2097152),
('knowledge_files', 'knowledge_files', false, 10485760)
on conflict (id) do update set file_size_limit = EXCLUDED.file_size_limit;

-- Restrict bot_avatars so users can strictly only upload to their own user ID folder
create policy "Bot Avatar Uploads" on storage.objects for insert to authenticated with check ( 
  bucket_id = 'bot_avatars' AND 
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Restrict article_images to workspaces the user has access to
create policy "Article Image Uploads" on storage.objects for insert to authenticated with check ( 
  bucket_id = 'article_images' AND 
  (
    exists (
      select 1 from public.bot_config
      where bot_config.space_id = (string_to_array(name, '/'))[1]
      and bot_config.user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.team_members
      where team_members.space_id = (string_to_array(name, '/'))[1]
      and team_members.email = (auth.jwt() ->> 'email')
    )
  )
);

-- For chat_attachments, restrict uploads to authenticated dashboard users only to prevent abuse
create policy "Authenticated Chat Attachments Uploads" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat_attachments'
);

create policy "Allow public viewing" on storage.objects for select using ( bucket_id in ('chat_attachments', 'article_images', 'bot_avatars') );

-- 5. Row Level Security (RLS) Policies
-- Ensure RLS is enabled by default on all tables so anonymous queries are rejected
alter table public.bot_config enable row level security;
alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.live_messages enable row level security;
alter table public.live_sessions enable row level security;
alter table public.workspace_integrations enable row level security;
alter table public.data_sources enable row level security;
alter table public.leads enable row level security;
alter table public.tickets enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.space_insights enable row level security;
alter table public.help_center_articles enable row level security;
alter table public.faqs enable row level security;
alter table public.proactive_triggers enable row level security;
alter table public.chat_feedback enable row level security;
alter table public.bot_messages enable row level security;

-- Explicit Access Policies
create policy "Users can view their own config" on public.bot_config for select using (auth.uid() = user_id);
create policy "Agents can view assigned config" on public.bot_config for select using (
  exists (
    select 1 from public.team_members
    where team_members.space_id = bot_config.space_id
    and team_members.email = (auth.jwt() ->> 'email')
  )
);

-- NOTE: Public insert policies for live_messages and live_sessions have been removed.
-- All inserts are now handled securely via the Next.js API routes using the Service Role Key.

create policy "Allow owners and agents to update live_sessions" on public.live_sessions for update using (
  exists (
    select 1 from public.bot_config
    where bot_config.space_id = live_sessions.space_id
    and bot_config.user_id = auth.uid()
  )
  or
  exists (
    select 1 from public.team_members
    where team_members.space_id = live_sessions.space_id
    and team_members.email = (auth.jwt() ->> 'email')
  )
);

create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can view own profile." on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

create policy "Users can view team members of their spaces" on public.team_members for select using (
  exists (
    select 1 from public.bot_config
    where bot_config.space_id = team_members.space_id
    and bot_config.user_id = auth.uid()
  )
  or
  team_members.email = (auth.jwt() ->> 'email')
);
