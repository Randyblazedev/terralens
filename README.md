# TerraLens

**Explore Earth Through a New Lens.**

TerraLens is an image-first place discovery platform. A photo is the entry point; the place is the core object.

The full product combines:

- Community place uploads
- Multiple photos per place
- Place descriptions and practical context
- Search and visual discovery
- Likes and saves
- Collections
- Creator profiles
- Trip planning
- AI itinerary assistance
- Similar-place discovery
- SEO/OG foundations
- Affiliate-ready place links
- Sponsored-place-ready data model
- Creator-ready product/guide links

## Product loop

**Discover → Open a place → Understand it → Save it → Build a trip → Visit → Contribute**

## Stack

- Static frontend: HTML + Tailwind CSS v4 browser build + vanilla JavaScript
- Auth/data/storage: Supabase
- Discovery fallback/seed imagery: Unsplash API through `/api/unsplash/search`
- AI: OpenRouter through `/api/ai/chat`
- Maps: Leaflet + OpenStreetMap tiles in the included map layer
- Deployment: Vercel

## Important security rule

Never put `UNSPLASH_ACCESS_KEY` or `OPENROUTER_API_KEY` in browser code.

Only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are used by the browser. They are generated into a runtime config during the Vercel build; the publishable key is intended for client-side use.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase URL and publishable key.
3. Add Unsplash and OpenRouter keys for server functions.
4. Run the SQL in `supabase/schema.sql`.
5. In Supabase Storage, create a public bucket named `place-images`, or run the storage section in the SQL.
6. In Supabase Auth, enable Google and add your Vercel/local callback URL.
7. Deploy to Vercel.
8. Add the same environment variables in Vercel Project Settings.

## Local development

This is intentionally a browser-first build, so there is no required frontend build step.

For the `/api` serverless functions locally, use Vercel CLI:

```bash
npm run dev
```

A plain static server can still load the pages, but `/api` endpoints will not execute.

## Environment

See `.env.example`.

## Product stages in one codebase

### Foundation
- Home
- Explore
- Place pages
- Upload
- Authentication
- Saved places
- Profiles
- SEO

### Community
- Multiple contributors
- Likes
- Collections
- Public collections
- Creator profiles
- Place comments
- Creator statistics

### Planning
- Trips
- Trip days
- Places inside trips
- Place-to-place planning
- Practical place information

### Intelligence
- AI travel assistant
- Itinerary generation
- Similar place recommendations
- Natural-language discovery

### Business
- Affiliate-ready links
- Sponsored place fields
- Creator guide/product fields
- Future premium feature flags

The UI exposes these as one product rather than pretending they are separate unfinished projects.

## Build philosophy

Research → Design → HTML → CSS/Tailwind → JavaScript → APIs → AI → Deploy.

No copied product UI. The goal is to understand the engineering behind the system.
