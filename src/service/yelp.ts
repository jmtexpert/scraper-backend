import axios from "axios";

const API_KEY = "YOUR_YELP_API_KEY"; // 🔑 Replace with your Yelp key
const BASE_URL = "https://api.yelp.com/v3/businesses/search";

export async function fetchYelpData(location: string, term: string) {
  try {
    const response = await axios.get(BASE_URL, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      params: {
        location, 
        term,
        limit: 10,
      },
    });

    const businesses = response.data.businesses;
    console.log("✅ Total found:", response.data.total);
    businesses.forEach((b: any) => {
      console.log(`${b.name} | ⭐ ${b.rating} | 📍 ${b.location.address1}`);
    });
  } catch (error: any) {
    console.error("❌ Error fetching Yelp data:", error.response?.data || error.message);
  }
}

// Example usage
