import puppeteer from "puppeteer";
import axios from "axios";

interface BusinessData {
  name: string;
  website: string;
  category: string;
  location: string;
  trustpilotUrl: string;
  emails: string[];
  phones: string[];
}

interface ContactData {
  emails: string[];
  phones: string[];
}

interface ScrapeResult {
  success: boolean;
  data: BusinessData[];
  total: number;
  term: string;
  pagesScraped: number;
}

const emailRegex: RegExp = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex: RegExp = /(\+?\d[\d\s().-]{7,}\d)/g;

async function extractContacts(url: string): Promise<ContactData> {
  try {
    const html: string = (await axios.get(url, { timeout: 15000 })).data;
    const emails: string[] = (html.match(emailRegex) as string[]) || [];
    const phones: string[] = (html.match(phoneRegex) as string[]) || [];
    return {
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
    };
  } catch {
    return { emails: [], phones: [] };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function scrapeTrustpilotBusinesses(
  term: string, 
  maxPages: number = 3
): Promise<ScrapeResult> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  const results: BusinessData[] = [];
  let pagesScraped = 0;

  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    try {
      const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(term)}&page=${currentPage}`;
      console.log(`🔍 Searching page ${currentPage}:`, searchUrl);
      
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

      await page.waitForSelector('a[href^="/review/"]', { timeout: 20000 });

      const links: string[] = await page.$$eval('a[href^="/review/"]', (els) =>
        Array.from(new Set(els.map((a) => (a as HTMLAnchorElement).href)))
      );

      console.log(`✅ Page ${currentPage}: Found ${links.length} businesses`);

      if (links.length === 0) {
        console.log(`❌ No businesses found on page ${currentPage}, stopping pagination.`);
        break;
      }

      for (const url of links.slice(0, 10)) {
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

          const data = await page.evaluate(() => {
            const name =
              document.querySelector("h1")?.textContent?.trim() || "";
            const website =
              Array.from(document.querySelectorAll("a"))
                .map((a) => (a as HTMLAnchorElement).href)
                .find(
                  (href) =>
                    href.includes("http") && !href.includes("trustpilot.com")
                ) || "";
            const category =
              document.querySelector('[data-service-category]')?.textContent?.trim() ||
              "";
            const location =
              document.querySelector('[data-location-name]')?.textContent?.trim() ||
              document.querySelector("address")?.textContent?.trim() ||
              "";

            return { name, website, category, location };
          });

          let emails: string[] = [];
          let phones: string[] = [];

          if (data.website) {
            const contacts: ContactData = await extractContacts(data.website);
            emails = contacts.emails;
            phones = contacts.phones;
          }

          const businessData: BusinessData = {
            ...data,
            trustpilotUrl: url,
            emails,
            phones
          };
          
          results.push(businessData);
          console.log(`➡️ ${data.name} (${emails.length} emails, ${phones.length} phones)`);
        } catch (err) {
          console.log("❌ Error scraping business:", url);
        }
      }

      pagesScraped++;

      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('[name="pagination-button-next"]');
        return nextButton && !nextButton.hasAttribute('disabled');
      });

      if (!hasNextPage) {
        console.log("📄 No more pages available.");
        break;
      }

      await delay(2000);

    } catch (error) {
      console.log(`❌ Error scraping page ${currentPage}:`, error);
      break;
    }
  }

  console.log("✅ Total businesses scraped:", results.length);
  console.log("✅ Total pages scraped:", pagesScraped);
  console.table(results);

  await browser.close();

  return {
    success: true,
    data: results,
    total: results.length,
    term: term,
    pagesScraped: pagesScraped
  };
}

// scrapeTrustpilotBusinesses("real estate karachi") // Default: 3 pages
// scrapeTrustpilotBusinesses("real estate karachi", 5) // Custom: 5 pages
// scrapeTrustpilotBusinesses("real estate karachi", 1) // Only first page