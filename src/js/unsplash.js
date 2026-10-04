export async function searchUnsplash({query,page=1,perPage=18}={}) {
  if (!query?.trim()) return {results:[],total:0,total_pages:0};
  const params = new URLSearchParams({query:query.trim(),page:String(page),per_page:String(perPage),orientation:"landscape",order_by:"relevant"});
  const r = await fetch(`/api/unsplash/search?${params}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Unable to search imagery");
  return data;
}
