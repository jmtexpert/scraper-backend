import puppeteer from "puppeteer";


interface ContactData {
  emails: string[];
  phones: string[];
  address: string;

}



export async function getTrustpilotReviewUrls(
  term: string,
  location: string = "",
  minPage: number = 1,
  maxPages: number = 3
): Promise<string[]> {

  const browser = await puppeteer.launch({
    headless: false, // 🔥 keep browser OPEN for debugging
    executablePath:
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: null,
  });

  const allUrls = new Set<string>();

  for (let pageNum = minPage; pageNum <= maxPages; pageNum++) {

    // ✅ NEW CLEAN CONTEXT (replacement of incognito)
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.setCacheEnabled(false);

    const searchUrl = location
      ? `https://www.trustpilot.com/search?query=${encodeURIComponent(
          term
        )}&location=${encodeURIComponent(location)}&page=${pageNum}`
      : `https://www.trustpilot.com/search?query=${encodeURIComponent(
          term
        )}&page=${pageNum}`;

    console.log(`🔍 Page ${pageNum}: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // ⏳ WAIT FOR REAL RESULTS (hydrated)
    await page.waitForSelector(
      'a[name="business-unit-card"]',
      { timeout: 30000 }
    );

    // ✅ Extract correct business URLs
    const urls = await page.$$eval(
      'a[name="business-unit-card"]',
      (anchors) =>
        anchors
          .map(a => a.getAttribute("href"))
          .filter(Boolean)
          .map(href => "https://www.trustpilot.com" + href)
    );

    urls.forEach(u => allUrls.add(u));

    console.log(`✅ Found ${urls.length} URLs`);

    await page.close();
    await context.close();

    // ⏸ delay (anti-bot)
    await new Promise(r => setTimeout(r, 4000));
  }

  await browser.close();

  console.log(`🎯 TOTAL UNIQUE URLS: ${allUrls.size}`);
  return [...allUrls];
}
export async function scrapeTrustpilotBusinessDetails(
  reviewUrls: string[]
): Promise<
  {
    website: string;
    name: string;
    emails: string[];
    phones: string[];
    address: string;
  }[]
> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  const results: {
    website: string;
    name: string;
    emails: string[];
    phones: string[];
    address: string;
  }[] = [];

  for (const reviewUrl of reviewUrls) {
    console.log(`🔎 Scraping business details from: ${reviewUrl}`);

    // ✅ Skip invalid URLs
    if (typeof reviewUrl !== "string" || !reviewUrl.startsWith("http")) {
      console.log(`⚠️ Skipping invalid URL:`, reviewUrl);
      results.push({
        website: "",
        name: "",
        emails: [],
        phones: [],
        address: "",
      });
      continue;
    }

    try {
      await page.goto(reviewUrl, { waitUntil: "networkidle2", timeout: 30000 });

      const data = await page.evaluate(() => {
        const name = document.querySelector("h1")?.textContent?.trim() || "";
        const website =
          Array.from(document.querySelectorAll("a"))
            .map((a) => (a as HTMLAnchorElement).href)
            .find(
              (href) =>
                href.includes("http") && !href.includes("trustpilot.com")
            ) || "";
        return { name, website };
      });

      let contactData: ContactData = { emails: [], phones: [], address: "" };

      if (data.website) {
        contactData = await extractContacts(data.website);
      }

      results.push({ ...data, ...contactData });
    } catch (error) {
      console.log(`❌ Error fetching ${reviewUrl}:`, error);
      results.push({
        website: "",
        name: "",
        emails: [],
        phones: [],
        address: "",
      });
    }
  }

  await browser.close();
  return results;
}

async function extractContacts(url: string): Promise<ContactData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const html = await page.content();

    // ✅ Email extraction
    const emailRegex =
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(html.match(emailRegex) || [])];

    // ✅ Phone extraction (strict)
    const phoneRegex =
      /\+?\d{1,3}?[-.\s(]?\d{2,4}[-.\s)]?\d{3,4}[-.\s]?\d{3,4}\b/g;
    const rawPhones = [...new Set(html.match(phoneRegex) || [])];
    const phones = rawPhones.filter(
      (num) =>
        !num.includes(".") &&
        !num.includes("%") &&
        num.replace(/\D/g, "").length >= 7
    );

    // ✅ Simple address detection (optional)
    const addressMatch = html.match(
      /\d{1,5}\s+[A-Za-z0-9\s.,'-]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Blvd|Boulevard|Way|Plaza|Square|Court|Ct)\b[^<\n]*/i
    );
    const address = addressMatch ? addressMatch[0].trim() : "";

    await browser.close();

    return { emails, phones, address };
  } catch (error) {
    console.log(`⚠️ Error extracting contacts from ${url}:`, error);
    await browser.close();
    return { emails: [], phones: [], address: "" };
  }
}
export interface TrustpilotData {
  url: string;
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export async function scrapeTrustpilotDetails(url: string): Promise<TrustpilotData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    const data = await page.evaluate(() => {
      const getText = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || "";

  

      const companyName = getText("h1");
      const description =
        document.querySelector(
          '[data-relevant-review-text-typography="true"] span.styles_previewText__afbaG'
        )?.textContent?.trim() || "";

      const contactItems = Array.from(
        document.querySelectorAll("ul.styles_itemsColumn__N6BEW li")
      );

      let address = "";
      let phone = "";
      let email = "";
      let website = "";

      contactItems.forEach((li) => {
        const a = li.querySelector("a");
        const href = a?.getAttribute("href") || "";

        if (href.startsWith("tel:")) phone = href.replace("tel:", "").trim();
        else if (href.startsWith("mailto:")) email = href.replace("mailto:", "").trim();
        else if (href.startsWith("http")) website = href.trim();
        else {
          const p = li.querySelector("p");
          if (p) address = p.textContent?.trim() || "";
        }
      });

      return {
        name: companyName,
        description,
        address,
        phone,
        email,
        website,
      };
    });

    return { url, ...data };
  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error);
    return { url, name: "", phone: "", email: "", website: "", address: "" };
  } finally {
    await browser.close();
  }
}