import puppeteer, { Browser, Page } from "puppeteer";

async function scrapeGoogleMaps(query: string, maxResults: number = 20) {
  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

  await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // Wait for container
  await page.waitForSelector('div[role="main"]', { timeout: 60000 });

  // Scroll dynamically to load more results
  let previousHeight = 0;
  for (let i = 0; i < 10; i++) {
    const currentHeight: number = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise((resolve) => setTimeout(resolve, 2000)); // ⬅ FIX: replace waitForTimeout
  }

  // Extract data
  const results = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[role="article"]'));
    return cards.map((card) => {
      const name =
        (card.querySelector("div.fontHeadlineSmall") as HTMLElement)?.innerText?.trim() || "";
      const address =
        (card.querySelector("div.fontBodyMedium") as HTMLElement)?.innerText?.trim() || "";
      const rating =
        (card.querySelector("span[aria-label*='stars']") as HTMLElement)?.getAttribute("aria-label") || "";
      return { name, address, rating };
    });
  });

  await browser.close();

  return results.slice(0, maxResults);
}

// Example test
scrapeGoogleMaps("restaurants in Lahore", 15)
  .then((data) => console.log("✅ Results:", data))
  .catch((err) => console.error("❌ Error:", err));

  