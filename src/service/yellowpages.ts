import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

export interface Biz {
  source: string;
  name?: string;
  phone?: string;
  website?: string;
  address?: string;
  link?: string;
}

export async function scrapeYellowPages(query: string, location = "", limit = 20): Promise<Biz[]> {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"], defaultViewport: { width: 1200, height: 800 }});
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");

  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(query)}&geo_location_terms=${encodeURIComponent(location)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

  // scroll to load
  await autoScroll(page);

  const data = await page.evaluate(() => {
    const results: any[] = [];
    const cards = document.querySelectorAll("div.result, div.search-results .result");
    cards.forEach(card => {
      const name = (card.querySelector("a.business-name")?.textContent || "").trim();
      const link = (card.querySelector("a.business-name") as HTMLAnchorElement)?.href || "";
      const phone = (card.querySelector(".phones")?.textContent || "").trim();
      const address = (card.querySelector(".street-address")?.textContent || "") + " " + (card.querySelector(".locality")?.textContent || "");
      results.push({ source: "yellowpages", name, phone, website: "", address: address.trim(), link });
    });
    return results;
  });

  await browser.close();
  return data.slice(0, limit);
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const dist = 400;
      const t = setInterval(() => {
        window.scrollBy(0, dist);
        total += dist;
        if (total >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(t);
          resolve();
        }
      }, 300);
    });
  });
}
