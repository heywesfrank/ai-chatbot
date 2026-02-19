# Minimalist RAG Chatbot

A barebones, high-performance RAG (Retrieval-Augmented Generation) chatbot designed to be embedded on customer websites. It uses GitBook as a knowledge base, Supabase for vector storage, and OpenAI's fast GPT-5 Nano for inference.

## Features
* **Minimalist UI/UX:** Clean, flat design with no unnecessary styling.
* **Simple GitBook Sync:** Uses a Personal Access Token to pull documentation directly from your GitBook Space.
* **Embeddable:** Includes a pre-configured, embed-friendly `/widget` route.
* **Edge-Ready:** Built on Next.js App Router for instant deployment to Vercel.

## Architecture
1. **Frontend:** Next.js + Tailwind CSS
2. **Database:** Supabase (`pgvector`)
3. **LLM:** OpenAI (`gpt-5-nano`)
4. **Hosting:** Vercel

## Environment Variables
To run this project locally or in production, you will need to add the following variables to your `.env.local` file (and your Vercel project settings). 

*(Note: GitBook credentials are provided by the user in the UI, so they do not need to be hardcoded here).*

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Supabase (Database & Vector Store)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
