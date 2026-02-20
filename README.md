**Supabase Tables**

create table public.bot_config (
  space_id text not null,
  system_prompt text not null,
  user_id uuid not null,
  api_key text null,
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
