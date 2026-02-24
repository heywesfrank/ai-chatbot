**Note:** This project uses the `gpt-5-nano` model via a custom `openai.responses.create` endpoint. Do not replace this with older models like `gpt-4o-mini` as it relies on specific formatting.

**Supabase Tables, Buckets, and Functions**

create table public.bot_config (
  space_id text not null,
  system_prompt text not null,
  user_id uuid not null,
  primary_color text null default '#000000'::text,
  header_text text null default 'Documentation Bot'::text,
  welcome_message text null default 'How can I help you today?'::text,
  bot_avatar text null,
  remove_branding boolean null default false,
  show_prompts boolean null default true,
  suggested_prompts jsonb null default '[]'::jsonb,
  lead_capture_enabled boolean null default false,
  agents_online boolean null default false,
  canned_responses jsonb null default '[]'::jsonb,
  language text null default 'Auto-detect'::text,
  temperature numeric null default 0.5,
  match_threshold numeric null default 0.2,
  reasoning_effort text null default 'medium'::text,
  verbosity text null default 'medium'::text,
  allowed_domains text null,
  constraint bot_config_pkey primary key (user_id),
  constraint bot_config_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create table public.data_sources (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  type text not null,
  source_uri text null,
  credentials jsonb null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
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
  embedding public.vector null,
  space_id text null,
  source_type text null default 'gitbook'::text,
  constraint knowledge_documents_pkey primary key (id)
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

  -- Create a public bucket for attachments
insert into storage.buckets (id, name, public) values ('chat_attachments', 'chat_attachments', true);

-- Allow public uploads to this bucket (for widget users)
create policy "Allow public uploads" on storage.objects for insert with check ( bucket_id = 'chat_attachments' );
create policy "Allow public viewing" on storage.objects for select using ( bucket_id = 'chat_attachments' );
