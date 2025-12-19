import puppeteer from "puppeteer";

export async function scrapeGoogleMaps(term: string, location: string) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const query = `${term} in ${location}`;
  const url = `https://www.google.com/maps`;
  console.log("🗺️ Opening:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });

  // ✅ Handle cookie consent or “Accept all” dialog if present
  try {
    const consentButton = await page.waitForSelector('button[aria-label^="Accept"]', { timeout: 5000 });
    if (consentButton) {
      await consentButton.click();
      console.log("✅ Accepted cookie consent");
      await page.waitForFunction(() => false, { timeout: 2000 });
    }
  } catch {}

  // ✅ Type search manually (more reliable than direct URL)
  await page.waitForSelector('input[aria-label="Search Google Maps"]', { timeout: 15000 });
  await page.type('input[aria-label="Search Google Maps"]', query);
  await page.keyboard.press("Enter");

  console.log(`🔍 Searching for: ${query}`);

  // ✅ Wait for results list (it may take time)
  await page.waitForFunction(
    () => document.querySelectorAll('div[role="feed"] div[jsaction][tabindex="0"]').length > 0,
    { timeout: 60000 }
  );

  // ✅ Extract results
  const results = await page.evaluate(() => {
    const cards = document.querySelectorAll('div[role="feed"] div[jsaction][tabindex="0"]');
    const data: any[] = [];

    cards.forEach((card) => {
      const name = card.querySelector("div[aria-level='3']")?.textContent?.trim() || "";
      const rating =
        card.querySelector('span[aria-label*="stars"]')?.getAttribute("aria-label") || "";
      const reviews = card.querySelector('span[aria-label*="reviews"]')?.textContent || "";
      const linkEl = card.querySelector("a[href^='/maps/place/']");
      const link = linkEl ? "https://www.google.com" + linkEl.getAttribute("href") : "";

      if (name && link) {
        data.push({ name, rating, reviews, link });
      }
    });
    return data;
  });

  console.log("✅ Found:", results.length, "places");
  console.table(results);

  await browser.close();
  return results;
}

// Example usage
(async () => {
  await scrapeGoogleMaps("coffee shop", "New York, NY");
})();
