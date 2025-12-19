import { Router, Request, Response } from 'express';
import { MapScraperService } from '../service/mapScraper';
import { getTrustpilotReviewUrls, scrapeTrustpilotDetails } from '../service/pupe/trustpilot';
import { scrapeLinkedInPeople } from '../service/pupe/linkedin';
import { scrapeGoogleMaps } from '../service/pupe/google-map';
import { scrapeYelpStealth } from '../service/pupe/yelp_p';


const router = Router();
const scraperService = new MapScraperService();

router.get('/scrape', async (req: Request, res: Response) => {
  try {
   const { query, location, limit =10, provider } = req.query as {
  query?: string;
  location?: string;
  limit?: number;
  provider?: string;
};

    if (!query) {
      return res.status(400).json({ 
        error: 'Query parameter is required' 
      });
    }

    let results;
    if (provider === 'google') {
      results = await scraperService.scrapeGooglePlaces(query, location, limit);
    } else {
      results = await scraperService.scrapeOpenStreetMap(query, location, limit);
    }

    res.json({
      success: true,
      count: results.length,
      provider: provider,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});
3
router.get('/yelp', async (_req: Request, res: Response) => {
try {
  const data = await scrapeYelpStealth("Restaurants", "San Francisco, CA");
  res.json(data)
} catch (error) {
  
}
});
router.get("/trustpilot", async (req: Request, res: Response) => {
  const { query, location, frompage, topage } = req.query as {
    query?: string;
    location?: string;
    frompage?: string;
    topage?: string;
  };

  if (!query) {
    return res.status(400).json({ error: "Missing 'query' parameter" });
  }

  try {
    const maxPages = topage ? parseInt(topage) : 1;
    const minPages = frompage ? parseInt(frompage) : 1;
    const data = await getTrustpilotReviewUrls(query, location || "",minPages, maxPages);
    res.json({ success: true, total: data.length, results: data });
  } catch (error) {
    console.error("❌ Error in /trustpilot API:", error);
    res.status(500).json({ success: false, error: "Failed to fetch Trustpilot data" });
  }
});
router.post("/trustpilot-profile", async (req: Request, res: Response) => {
  try {
    const { urls } = req.body as { urls: string[] };
    console.log(urls);
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "Body must contain an array 'urls'" });
    }

    const results = [];
    for (const url of urls) {
      const data = await scrapeTrustpilotDetails(url);
      results.push(data);
    }

    res.json({ success: true, total: results.length, results });
  } catch (error) {
    console.error("❌ Error fetching Trustpilot profiles:", error);
    res.status(500).json({ success: false, error: "Failed to fetch Trustpilot profiles" });
  }
});
router.post("/linkedin-people", async (req: Request, res: Response) => {
  const { cookies, title, location, limit = 10 } = req.body;

  if (!cookies || !title || !location)
    return res.status(400).json({ error: "cookies, title, and location required" });

  try {
    const people = await scrapeLinkedInPeople({ cookies, title, location, limit });
    res.json({ success: true, total: people.length, people });
  } catch (err: any) {
    console.error("❌ LinkedIn Scraper Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get("/google-map", async (req, res) => {
  try {
    const query = req.query.query?.toString() || "";
    const location = req.query.location?.toString() || "";
    const limit = parseInt(req.query.limit?.toString() || "5");

    if (!query || !location)
      return res.status(400).json({ error: "query & location required" });

    const data = await scrapeGoogleMaps(query, location, limit);

    res.json({
      query,
      location,
      count: data.length,
      results: data
    });

  } catch (err) {
    res.status(500).json({ error: "Scraping failed", details: err });
  }
});

export default router;