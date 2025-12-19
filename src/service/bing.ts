import axios from "axios";

const BING_KEY = process.env.BING_KEY;

export interface Biz {
  source: string;
  name?: string;
  phone?: string;
  website?: string;
  address?: string;
  lat?: number;
  lon?: number;
}

export async function searchBing(query: string, limit = 20): Promise<Biz[]> {
  if (!BING_KEY) throw new Error("BING_KEY missing in .env");
  const url = `https://api.bing.microsoft.com/v7.0/localbusinesses/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const res = await axios.get(url, { headers: { "Ocp-Apim-Subscription-Key": BING_KEY }});
  const items = (res.data?.value || []) as any[];
  return items.map(it => ({
    source: "bing",
    name: it.name,
    phone: it.phone || it.telephone || "",
    website: it.website || it.url || "",
    address: it.address?.formattedAddress || it.address?.addressLocality || "",
    lat: it.geo?.latitude,
    lon: it.geo?.longitude,
  }));
}
