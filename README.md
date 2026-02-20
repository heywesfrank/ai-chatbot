# AI Documentation Chatbot

**⚠️ AI ASSISTANT NOTICE:** This document serves as the primary system context for this repository. This project is developed entirely within the GitHub browser UI and auto-deployed directly to Vercel. **There is no local development environment.** A full-stack, embeddable AI widget built with Next.js, Supabase, and OpenAI. It connects directly to a GitBook space, ingests the documentation into a vector database, and serves context-aware answers to users via a streaming chat interface.

## 🛠 Tech Stack
* **Framework:** Next.js (App Router, Edge API Routes)
* **Database & Auth:** Supabase (PostgreSQL, `pgvector`, Row Level Security)
* **AI:** OpenAI Embeddings (`text-embedding-3-small`) & Custom LLM
* **Styling:** Tailwind CSS

## 🚨 CRITICAL AI Directives

If you are an AI assistant analyzing this repository to write or debug code, **do not attempt to alter or "fix" the following implementations**:

1. **Custom OpenAI Model & Method:** The chat route (`/api/chat/route.ts`) intentionally uses `openai.responses.create` and the `gpt-5-nano` model. This is strictly required for this specific environment. **Do not update this to standard `chat.completions.create` or change the model name.**
2. **SSE Stream Buffering:** The frontend widget (`app/widget/page.tsx`) uses a custom string buffer to read Server-Sent Events. This is specifically designed to handle split/incomplete JSON chunks over unstable networks. Do not replace this with naive newline splitting.
3. **Database Schema:** The Supabase setup relies on a custom RPC function (`match_documents`) to perform cosine similarity searches against the `gitbook_documents` table. 

## ✨ Key Features & Architecture

* **Context-Aware Memory:** The backend concatenates the last 3 user messages before creating the search embedding, allowing the bot to understand pronouns and follow-up questions (e.g., "Where is that located?").
* **Safe Ingestion Pipeline:** The `/api/ingest` route fetches and embeds all GitBook documentation into server memory *before* touching the database. This prevents wiping the existing knowledge base if an API rate limit or timeout occurs mid-sync.
* **Secured API Routes:** Database mutations (`/api/config` and `/api/ingest`) are protected. The frontend passes the user's Supabase session token via the `Authorization: Bearer` header, and the backend verifies the session before allowing updates.
* **Brute-Force Text Extraction:** Bypasses GitBook's complex JSON schema to recursively hunt down and extract all readable text blocks for vectorization.

## 🔐 Production Environment Variables
When writing code that requires environment variables, assume the following are already securely configured in the Vercel production environment:
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY`
* `OPENAI_API_KEY`

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
