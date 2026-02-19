# Minimalist RAG Chatbot

A barebones, high-performance RAG (Retrieval-Augmented Generation) chatbot designed to be embedded on customer websites. It uses GitBook as a knowledge base, Supabase for vector storage, and OpenAI's GPT-5 Nano for fast, cost-effective inference.

## Features
* **Minimalist UI/UX:** Clean, flat design with no unnecessary styling.
* **GitBook Integration:** OAuth flow to pull documentation directly from GitBook.
* **Embeddable:** Includes a pre-configured, embed-friendly `/widget` route.
* **Edge-Ready:** Built on Next.js App Router for deployment to Vercel.

## Architecture
1. **Frontend:** Next.js + Tailwind CSS
2. **Database:** Supabase (`pgvector`)
3. **LLM:** OpenAI (`gpt-5-nano`)
4. **Hosting:** Vercel

## Environment Variables
To run this project locally or in production, you will need to add the following variables to your `.env.local` file (and your Vercel project settings):

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Supabase (Database & Vector Store)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# GitBook (OAuth Flow)
GITBOOK_CLIENT_ID=your_gitbook_oauth_client_id
GITBOOK_CLIENT_SECRET=your_gitbook_oauth_client_secret
