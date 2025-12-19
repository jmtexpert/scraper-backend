import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gmi;
const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;

export async function extractContactsFromSite(url: string) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"], defaultViewport: { width: 1200, height: 900 }});
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (err) {
    // try homepage only
    try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }); } catch {}
  }

  // optional: visit common pages
  const candidates = [url, `${url.replace(/\/$/,"")}/contact`, `${url.replace(/\/$/,"")}/contact-us`, `${url.replace(/\/$/,"")}/about`];
  let html = "";
  for (const c of candidates) {
    try {
      await page.goto(c, { waitUntil: "networkidle2", timeout: 20000 });
      html += await page.content();
    } catch {}
  }

  const emails = Array.from(new Set((html.match(emailRegex) || []).map((s:string)=>s.trim())));
  const phones = Array.from(new Set((html.match(phoneRegex) || []).map((s:string)=>s.trim())));

  await browser.close();
  return { url, emails, phones };
}
