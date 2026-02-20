# Minimalist RAG Chatbot

A barebones, high-performance RAG (Retrieval-Augmented Generation) chatbot designed to be embedded on customer websites. It uses GitBook as a knowledge base, Supabase for vector storage, and OpenAI's fast GPT-5 Nano for inference.

## Features
* **Split-Pane Workspace:** A SaaS-style dashboard that lets you configure your agent's persona on the left and instantly test it in a live playground on the right.
* **Cost-Optimized Updates:** Updating the bot's system prompt/persona is decoupled from the knowledge base sync, preventing unnecessary vector embedding costs.
* **Simple GitBook Sync:** Uses a Personal Access Token to pull documentation directly from your GitBook Space using efficient bulk ingestion and chunking.
* **Embeddable:** Includes a pre-configured, embed-friendly `/widget` route that seamlessly fits into your clients' websites.
* **Edge-Ready & Streaming:** Built on the Next.js App Router using the Vercel Edge Runtime and Server-Sent Events (SSE) for blazing-fast, real-time streamed responses.

## Architecture
1. **Frontend:** Next.js + Tailwind CSS
2. **Database:** Supabase (`pgvector`)
3. **LLM:** OpenAI (`gpt-5-nano`, `text-embedding-3-small`)
4. **Hosting:** Vercel (Edge Runtime)

## API Routes
* `POST /api/config`: Lightweight endpoint that instantly updates the agent's persona (`system_prompt`) in the database.
* `POST /api/ingest`: Heavy endpoint that fetches the GitBook Table of Contents, scrapes all nested pages, chunks the text, generates OpenAI embeddings, and stores them in Supabase.
* `POST /api/chat`: The Edge-compatible chat route. It vector-searches the knowledge base based on the user's query, constructs the prompt, and streams the response back to the widget.

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
