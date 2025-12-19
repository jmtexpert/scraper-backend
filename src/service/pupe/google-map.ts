import puppeteer from "puppeteer";

export async function scrapeGoogleMaps(query: string, location: string, limit = 10) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,900"
    ],
  });

  const page = await browser.newPage();
  
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
  );

  console.log("➡ Opening Google Maps...");
  await page.goto("https://www.google.com/maps", {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector("#searchboxinput", { visible: true });
  await page.type("#searchboxinput", `${query} in ${location}`);
  await page.keyboard.press("Enter");

  console.log("➡ Searching places...");
  
  await new Promise(res => setTimeout(res, 5000));
  
  await page.waitForSelector("div[role='feed']", { timeout: 15000 });

 
  const scrollContainer = await page.$("div[role='feed']");
  
  if (scrollContainer) {
    for (let i = 0; i < 5; i++) {
      await page.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      }, scrollContainer);
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  const items = await page.$$("div[role='feed'] a[href*='/maps/place/']");

  console.log("📌 Total List Items Found:", items.length);

  if (items.length === 0) {
    console.log("⚠️ No results found. Try a different search query.");
    await browser.close();
    return [];
  }

  const results: any[] = [];    

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    try {
      console.log(`\n⏳ Scraping item ${i + 1}/${Math.min(limit, items.length)}...`);
      
      const currentItems = await page.$$("div[role='feed'] a[href*='/maps/place/']");
      
      if (!currentItems[i]) {
        console.log(`⚠️ Item ${i + 1} not found, skipping...`);
        continue;
      }

      await currentItems[i].click();
      
      await page.waitForFunction(
        () => {
          const nameElement = document.querySelector("h1.fontHeadlineLarge") || 
                            document.querySelector("h1[role='heading']") ||
                            document.querySelector("h1");
          return nameElement && nameElement.textContent && nameElement.textContent.trim().length > 0;
        },
        { timeout: 10000 }
      );
      
      await new Promise(res => setTimeout(res, 2000));

      const place = await page.evaluate(() => {
        const text = (sel: string) => {
          const el = document.querySelector(sel);
          return el ? el.textContent?.trim() : "";
        };

        const link = (sel: string) => {
          const el = document.querySelector(sel) as HTMLAnchorElement;
          return el ? el.href : "";
        };

        const nameElement = 
          document.querySelector("h1.fontHeadlineLarge") ||
          document.querySelector("h1[role='heading']") ||
          document.querySelector("h1");

        const ratingElement = 
          document.querySelector("span[role='img'][aria-label*='stars']") ||
          document.querySelector("div.fontDisplayLarge") ||
          document.querySelector("[aria-label*='stars']");

        let rating = "";
        let reviews = "";

        if (ratingElement) {
          const ariaLabel = ratingElement.getAttribute('aria-label');
          if (ariaLabel) {
            const ratingMatch = ariaLabel.match(/(\d+\.?\d*)\s+stars/);
            const reviewsMatch = ariaLabel.match(/(\d+(?:,\d+)*)\s+reviews/);
            rating = ratingMatch ? ratingMatch[1] : "";
            reviews = reviewsMatch ? reviewsMatch[1] : "";
          }
        }

        return {
          name: nameElement?.textContent?.trim() || "",
          rating: rating,
          reviews: reviews,
          address: text("button[data-item-id='address']") || 
                  text("button[aria-label*='Address']") ||
                  text("[data-tooltip*='Address']"),
          phone: text("button[data-item-id*='phone:tel']") || 
                text("button[aria-label*='Phone']") ||
                text("[data-tooltip*='Phone']"),
          website: link("a[data-item-id='authority']") || 
                  link("a[aria-label*='Website']") ||
                  link("[data-tooltip*='Website']"),
          plusCode: text("button[data-item-id='oloc']"),
          url: window.location.href
        };
      });

      console.log(`✔ Scraped ${i + 1}/${Math.min(limit, items.length)}:`, place.name || "Unknown");
      
      if (place.name) {
        results.push(place);
      } else {
        console.log(`⚠️ No name found for item ${i + 1}, skipping...`);
      }
      await page.goBack();
      
      await page.waitForSelector("div[role='feed']", { timeout: 10000 });
      await new Promise(res => setTimeout(res, 2000));

    } catch (error: any) {
      console.error(`❌ Error scraping item ${i + 1}:`, error.message);
      continue;
    }
  }

  await browser.close();
  
  console.log(`\n✅ Successfully scraped ${results.length} places`);
  return results;
}

// scrapeGoogleMaps("restaurants", "New York", 5).then(console.log);