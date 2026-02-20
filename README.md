## 🗄️ Database Schema (Supabase)

To understand the backend structure, refer to the following SQL schema currently active in the production Supabase database. *Note: The `pgvector` extension is enabled.*

```sql
-- Table 1: Bot Configuration
create table bot_config (
  space_id text primary key,
  system_prompt text not null,
  user_id uuid not null -- References the authenticated user who owns this config
);

-- Table 2: GitBook Documents (Knowledge Base)
create table gitbook_documents (
  id bigserial primary key,
  space_id text not null,
  page_url text not null,
  content text not null,
  embedding vector(1536) -- 1536 dimensions for text-embedding-3-small
);

-- Index for faster vector similarity search
create index on gitbook_documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- RPC Function: Vector Similarity Search
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_space_id text
)
returns table (
  id bigint,
  content text,
  page_url text,
  similarity float
)
language sql stable
as $$
  select
    gitbook_documents.id,
    gitbook_documents.content,
    gitbook_documents.page_url,
    1 - (gitbook_documents.embedding <=> query_embedding) as similarity
  from gitbook_documents
  where gitbook_documents.space_id = p_space_id
    and 1 - (gitbook_documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
