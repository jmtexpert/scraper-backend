import axios from "axios";

const FQ_KEY = process.env.FOURSQUARE_KEY;

export interface Biz {
  source: string;
  name?: string;
  phone?: string;
  website?: string;
  address?: string;
  lat?: number;
  lon?: number;
}

export async function searchFoursquare(query: string, near = "", limit = 20): Promise<Biz[]> {
  if (!FQ_KEY) throw new Error("FOURSQUARE_KEY missing in .env");

  // Foursquare Places API (example: /search or textsearch depending on plan)
  const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&near=${encodeURIComponent(near)}&limit=${limit}`;
  const res = await axios.get(url, { headers: { Authorization: FQ_KEY }});
  const items = (res.data?.results || []) as any[];
  return items.map((it: any) => ({
    source: "foursquare",
    name: it.name,
    phone: it.tel || it.phone || "",
    website: it.website || "",
    address: it.location?.formatted_address || [it.location?.locality, it.location?.region].filter(Boolean).join(", "),
    lat: it.geocodes?.main?.latitude,
    lon: it.geocodes?.main?.longitude,
  }));
}
