import puppeteer from "puppeteer";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;

export async function extractContacts(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const textContent = await page.evaluate(() => document.body.innerText);
    console.log("PAGE TEXT SAMPLE:", textContent.slice(0, 500)); 

    const emails = textContent.match(emailRegex) || [];
    const phones = textContent.match(phoneRegex) || [];

    console.log(" Extracted from", url);
    console.log("Emails:", emails);
    console.log("Phones:", phones);

    return { url, emails: [...new Set(emails)], phones: [...new Set(phones)] };
  } catch (error) {
    console.error(" Error:", (error as Error).message);
    return { url, emails: [], phones: [] };
  } finally {
    await browser.close();
  }
}

// (async () => {
//   const data = await extractContacts("http://res-immotrust.de/");
//   console.log("FINAL DATA:", data);
// })();
