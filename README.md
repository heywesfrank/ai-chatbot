# Minimalist RAG Chatbot

A barebones, high-performance RAG (Retrieval-Augmented Generation) chatbot designed to be embedded on customer websites. It uses GitBook as a knowledge base, Supabase for vector storage, and OpenAI's fast GPT-5 Nano for inference.

## Features
* **Minimalist UI/UX:** Clean, flat design with no unnecessary styling.
* **Simple GitBook Sync:** Uses a Personal Access Token to pull documentation directly from your GitBook Space using efficient bulk ingestion.
* **Embeddable:** Includes a pre-configured, embed-friendly `/widget` route.
* **Edge-Ready & Streaming:** Built on Next.js App Router using the Vercel Edge Runtime and Server-Sent Events (SSE) for blazing-fast, real-time streamed responses.

## Architecture
1. **Frontend:** Next.js + Tailwind CSS
2. **Database:** Supabase (`pgvector`)
3. **LLM:** OpenAI (`gpt-5-nano`, `text-embedding-3-small`)
4. **Hosting:** Vercel (Edge Runtime)

## Database Setup

To run this project, you need a Supabase project with the `pgvector` extension enabled. Run the following SQL in your Supabase SQL Editor to set up the required tables and search function:

```sql
-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Table to store custom bot personas/configurations per GitBook space
create table public.bot_config (
  space_id text not null,
  system_prompt text not null,
  constraint bot_config_pkey primary key (space_id)
) TABLESPACE pg_default;

-- Table to store ingested GitBook documentation and their embeddings
create table public.gitbook_documents (
  id bigserial not null,
  page_url text not null,
  content text not null,
  embedding public.vector(1536) null, -- 1536 is the dimension for text-embedding-3-small
  space_id text null,
  constraint gitbook_documents_pkey primary key (id)
) TABLESPACE pg_default;

-- Function to perform vector similarity search
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
  order by gitbook_documents.embedding <=> query_embedding
  limit match_count;
$$;
