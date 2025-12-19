import puppeteer from "puppeteer";

interface Biz {
  source: string;
  name: string;
  website: string;
  trustpilotUrl: string;
}

export async function scrapeTrustpilotCompany(url: string): Promise<Biz | null> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
    defaultViewport: { width: 1200, height: 800 },
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});

  // 🕐 Replaces deprecated page.waitForTimeout()
  await new Promise(resolve => setTimeout(resolve, 2000));

  const data = await page.evaluate(() => {
    const name = (document.querySelector("h1")?.textContent || "").trim();
    let website = "";
    // Find external website link (non-Trustpilot)
    const link = Array.from(document.querySelectorAll("a")).find(
      el =>
        (el as HTMLAnchorElement).href.includes("http") &&
        !(el as HTMLAnchorElement).href.includes("trustpilot.com")
    );
    if (link) website = (link as HTMLAnchorElement).href;
    return { name, website };
  });

  await browser.close();

  if (!data.name) return null;
  return {
    source: "trustpilot",
    name: data.name,
    website: data.website,
    trustpilotUrl: url,
  };
}

// Example usage
(async () => {
  const company = await scrapeTrustpilotCompany("https://www.trustpilot.com/review/www.shopify.com");
  console.log(company);
})();
