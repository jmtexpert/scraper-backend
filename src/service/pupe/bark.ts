import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export async function scrapeBark(category: string, location: string) {
  const browser = await puppeteer.launch({
    headless: false, // 👈 try visible mode first for debugging
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  const url = `https://www.bark.com/en/pk/services/?q=${encodeURIComponent(
    category
  )}&l=${encodeURIComponent(location)}`;

  console.log("🔍 Opening:", url);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for something general (any business card-like element)
  await page.waitForSelector("div, article, li", { timeout: 30000 });

  // 👇 Scroll slowly to trigger lazy-loading
  await autoScroll(page);

  // 👇 Evaluate all text content and search for relevant business entries
  const data = await page.evaluate(() => {
    const businesses: any[] = [];
    const elements = Array.from(document.querySelectorAll("a[href*='/en/company/']"));
    for (const el of elements) {
      const link = (el as HTMLAnchorElement).href;
      const name = (el.textContent || "").trim();
      if (name.length > 3) {
        businesses.push({ name, link });
      }
    }
    return businesses;
  });

  console.log("✅ Found businesses:", data.length);
  await browser.close();
  return data;
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

// Test run
// (async () => {
//   const results = await scrapeBark("web development", "Karachi");
//   console.log(results.slice(0, 5)); // show first 5
// })();
