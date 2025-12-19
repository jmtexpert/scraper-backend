import puppeteer from "puppeteer";

export async function scrapeLinkedInPeople({
  cookies,
  title,
  location,
  limit,
}: {
  cookies: string;
  title: string;
  location: string;
  limit: number;
}) {

  const cookieList = cookies
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, ...rest] = pair.split("=");
      return {
        name,
        value: rest.join("="),
        domain: "www.linkedin.com", 
        path: "/",
        httpOnly: false,
        secure: true,
      };
    });

  const browser = await puppeteer.launch({
    headless: false, //   true on production
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

  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9",
    "upgrade-insecure-requests": "1",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    "sec-fetch-user": "?1",
    "sec-fetch-dest": "document",
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });

  await page.setViewport({ width: 1280, height: 800 });

  await page.setCookie(...cookieList);
  console.log("✅ Cookies applied:", cookieList.map((c) => c.name));

  const query = encodeURIComponent(`${title} ${location}`);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${query}`;
  console.log("🌍 Navigating to:", searchUrl);

  try {
    await page.goto(searchUrl, {
      waitUntil: ["domcontentloaded"],
      timeout: 120000,
    });
  } catch (err) {
    console.error("❌ Navigation error:", err);
  }

  await new Promise((r) => setTimeout(r, 6000));

  if (page.url().includes("login")) {
    await browser.close();
    throw new Error("Invalid or expired cookies (login required)");
  }

  // --- 8️⃣ Scroll and collect profile URLs
  const profileUrls = new Set<string>();
  while (profileUrls.size < limit) {
    const newLinks: string[] =
      (await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"))
          .map((a) => a.getAttribute("href"))
          .filter((href) => href && href.includes("/in/"))
          .map((href) => href!.split("?")[0]);
        return Array.from(new Set(anchors));
      })) || [];

    newLinks.forEach((url) => profileUrls.add(url));

    console.log(`✅ Found ${profileUrls.size} profiles so far...`);
    if (profileUrls.size >= limit) break;

    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 3000));
  }

  // --- 9️⃣ Visit profiles & scrape data
  const results: { name: string; title: string; location: string; url: string }[] = [];

  for (const profileUrl of Array.from(profileUrls).slice(0, limit)) {
    try {
      const profilePage = await browser.newPage();
      await profilePage.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await profilePage.goto(`https://www.linkedin.com${profileUrl}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await new Promise((r) => setTimeout(r, 3000));

      const data = await profilePage.evaluate(() => {
        const name =
          document.querySelector("h1")?.textContent?.trim() ||
          document.querySelector(".pv-top-card h1")?.textContent?.trim() ||
          "";
        const headline =
          document.querySelector(".text-body-medium.break-words")?.textContent?.trim() ||
          document.querySelector(".pv-text-details__left-panel span")?.textContent?.trim() ||
          "";
        const location =
          document.querySelector(".pv-top-card--list-bullet li")?.textContent?.trim() ||
          document.querySelector(".text-body-small.inline")?.textContent?.trim() ||
          "";
        return { name, title: headline, location };
      });

      results.push({ ...data, url: `https://www.linkedin.com${profileUrl}` });
      await profilePage.close();
      console.log(` Scraped: ${data.name}`);
    } catch (err) {
      console.warn(`⚠️ Skipping ${profileUrl}`);
    }
  }

  await browser.close();
  console.log(`🎯 Completed: ${results.length} profiles scraped`);
  return results;
}
