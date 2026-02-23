**Note:** This project uses the `gpt-5-nano` model via a custom `openai.responses.create` endpoint. Do not replace this with older models like `gpt-4o-mini` as it relies on specific formatting.

**Supabase Tables, Buckets, and Functions**

create table public.bot_config (
  space_id text not null,
  system_prompt text not null,
  user_id uuid not null,
  api_key text null,
  primary_color text null default '#000000'::text,
  header_text text null default 'Documentation Bot'::text,
  welcome_message text null default 'How can I help you today?'::text,
  bot_avatar text null,
  remove_branding boolean null default false,
  show_prompts boolean null default true,
  suggested_prompts jsonb null default '[]'::jsonb,
  lead_capture_enabled boolean null default false,
  constraint bot_config_pkey primary key (user_id),
  constraint bot_config_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create table public.gitbook_documents (
  id bigserial not null,
  page_url text not null,
  content text not null,
  embedding public.vector null,
  space_id text null,
  constraint gitbook_documents_pkey primary key (id)
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
  constraint live_messages_pkey primary key (id),
  constraint live_messages_session_id_fkey foreign KEY (session_id) references live_sessions (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.live_sessions (
  id uuid not null default gen_random_uuid (),
  space_id text not null,
  email text not null,
  status text null default 'open'::text,
  history text null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint live_sessions_pkey primary key (id)
) TABLESPACE pg_default;

  select
    gitbook_documents.id,
    gitbook_documents.space_id,
    gitbook_documents.page_url,
    gitbook_documents.content,
    1 - (gitbook_documents.embedding <=> query_embedding) as similarity
  from gitbook_documents
  where 1 - (gitbook_documents.embedding <=> query_embedding) > match_threshold
    and gitbook_documents.space_id = p_space_id
  order by gitbook_documents.embedding <=> query_embedding
  limit match_count;

  -- Create a public bucket for attachments
insert into storage.buckets (id, name, public) values ('chat_attachments', 'chat_attachments', true);

-- Allow public uploads to this bucket (for widget users)
create policy "Allow public uploads" on storage.objects for insert with check ( bucket_id = 'chat_attachments' );
create policy "Allow public viewing" on storage.objects for select using ( bucket_id = 'chat_attachments' );
