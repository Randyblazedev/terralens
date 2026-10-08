# TerraLens SEO guide

Nobody can promise rankings. This gives search engines everything they need, quickly and correctly. Results also depend on content, links from other sites and time.

## Do these first
1. **Vercel -> Environment Variables:** make sure `SITE_URL` is your real address with no slash at the end (for example `https://terralens.vercel.app`). Redeploy. Without it, canonical links and social images are skipped.
2. **Supabase SQL editor:** run `supabase/schema.sql` once (it now adds the category and country counts and search indexes).
3. **Google Search Console** (you already verified the site): Sitemaps -> add `sitemap.xml` -> Submit. Then use URL Inspection on the home page and one place page, and tap Request indexing.
4. **Bing Webmaster Tools:** import the site from Search Console, then submit `sitemap.xml` too (Bing also powers DuckDuckGo and others).
5. Check a place page in Google's Rich Results Test (search for it) and speed in PageSpeed Insights.

## What the site now does
- **Crawlable landing pages that can rank for real searches:** `/category/waterfall` ("Best Waterfalls to Visit") and `/country/cameroon` ("Places to Visit in Cameroon"), generated from your places with unique titles, descriptions, 24 places per page and real next/previous page links.
- **Place pages (`/place/<name>`):** full content in the first HTML (not only after JavaScript): H1, facts (best season, best time, how to get there, entry fee), photos with real alt text, breadcrumbs, related places and links to the category and country pages, plus structured data (TouristAttraction and BreadcrumbList) and Open Graph and Twitter tags.
- **Sitemaps that scale to millions of places:** `/sitemap.xml` is an index; each place file holds 2,000 places with photo entries. Category and country pages are listed too.
- **robots.txt:** only blocks the API. Private pages (login, profile, saved, upload, admin) use `noindex` so they drop out of search cleanly.
- **Every public page:** unique title (about 60 characters or fewer) and description, a canonical link, social cards, an app manifest and icons, and a custom 404 page that is not indexed.
- **Home page:** Organization and WebSite structured data, and the category tiles now link to the indexable category pages. Every footer links to the category pages too.
- **Speed (a ranking signal):** fonts load without blocking, Unsplash photos are requested at the size needed, the main photo is preloaded, and images have size hints.

## Things that help most from here
- Add more places with a full description, best season, access and entry fee. Pages with real detail rank; thin pages do not.
- Keep adding your own photos with good alt text.
- Get links from other sites: travel blogs, social media bios, local tourism pages and directories.
- Share place pages on social media. Link previews now show a proper title, description and image.
- Search Console -> Performance shows which searches bring people. Write more about the ones that almost rank.
