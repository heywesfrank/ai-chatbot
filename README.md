**Supabase Tables and Functions**

create table public.bot_config (
  space_id text not null,
  system_prompt text not null,
  user_id uuid not null,
  api_key text null,
  primary_color text default '#000000',
  header_text text default 'Documentation Bot',
  welcome_message text default 'How can I help you today?',
  bot_avatar text null,
  remove_branding boolean default false,
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
