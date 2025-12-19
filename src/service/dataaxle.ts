import axios from "axios";

/**
 * Template for Data Axle / InfoGroup / commercial provider.
 * You will need to consult your provider docs for exact endpoints & params.
 */

const DATA_AXLE_KEY = process.env.DATA_AXLE_KEY;

export interface Biz {
  source: string;
  name?: string;
  phone?: string;
  website?: string;
  address?: string;
  extra?: any;
}

export async function searchDataAxle(query: string, limit = 50): Promise<Biz[]> {
  if (!DATA_AXLE_KEY) {
    console.warn("DATA_AXLE_KEY not set — skipping Data Axle");
    return [];
  }

  // Example: placeholder URL — replace with real endpoint from vendor
  const url = `https://api.data-axle.com/v1/business/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${DATA_AXLE_KEY}` }});
  const items = res.data?.results || [];
  return items.map((it: any) => ({
    source: "data_axle",
    name: it.business_name || it.name,
    phone: it.phone,
    website: it.website,
    address: it.address?.formatted || "",
    extra: it,
  }));
}
