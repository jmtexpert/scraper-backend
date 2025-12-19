// // src/scraper.ts
// import fs from "fs";
// import path from "path";
// import fetch from "node-fetch";
// import PQueue from "p-queue";
// import createCsvWriter from "csv-writer";
// import puppeteerExtra from "puppeteer-extra";
// import stealth from "puppeteer-extra-plugin-stealth";
// import puppeteer from "puppeteer";

// // enable stealth
// puppeteerExtra.use(stealth());

// type Lead = {
//   url: string;
//   finalUrl?: string;
//   title?: string;
//   company?: string;
//   emails?: string[];
//   phones?: string[];
//   addresses?: string[];
//   socialLinks?: string[];
//   notes?: string;
// };

// // Helpers for regex extraction
// const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/gi;
// const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d\-.\s]{5,15}\d/gi;

// // Basic robots.txt check (doesn't fully parse rules; quick safety check)
// async function allowedByRobots(siteUrl: string): Promise<boolean> {
//   try {
//     const u = new URL(siteUrl);
//     const robotsUrl = `${u.origin}/robots.txt`;
//     const res = await fetch(robotsUrl, { method: "GET" });
//     if (!res.ok) return true; // no robots -> assume ok
//     const txt = await res.text();
//     // simple check: disallow: /
//     if (/Disallow:\s*\/\s*$/mi.test(txt)) return false;
//     // more complex parsing is recommended for production
//     return true;
//   } catch (e) {
//     return true;
//   }
// }

// // Extract emails/phones from text
// function extractAll(regex: RegExp, text: string): string[] {
//   const s = new Set<string>();
//   let m: RegExpExecArray | null;
//   while ((m = regex.exec(text))) {
//     s.add(m[0].trim());
//   }
//   return [...s];
// }

// // Write CSV
// const csvWriter = createCsvWriter.createObjectCsvWriter({
//   path: "leads.csv",
//   header: [
//     { id: "url", title: "Source URL" },
//     { id: "finalUrl", title: "Final URL" },
//     { id: "title", title: "Page Title" },
//     { id: "company", title: "Company" },
//     { id: "emails", title: "Emails" },
//     { id: "phones", title: "Phones" },
//     { id: "addresses", title: "Addresses" },
//     { id: "socialLinks", title: "Social Links" },
//     { id: "notes", title: "Notes" }
//   ]
// });

// async function scrapeOne(browser: puppeteer.Browser, target: string, opts: { timeoutMs: number }) : Promise<Lead> {
//   const lead: Lead = { url: target, emails: [], phones: [], addresses: [], socialLinks: [] };

//   // quick robots.txt safety
//   const ok = await allowedByRobots(target);
//   if (!ok) {
//     lead.notes = "Blocked by robots.txt (quick check)";
//     return lead;
//   }

//   const page = await browser.newPage();
//   // set a random-ish user agent (basic)
//   await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36");
//   await page.setViewport({ width: 1200, height: 800 });

//   try {
//     const resp = await page.goto(target, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs });
//     lead.finalUrl = page.url();

//     // wait small random time so JS content loads
//     await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

//     // get page title & company hints
//     lead.title = await page.title();
//     // try meta: og:site_name or meta[name="application-name"]
//     const siteName = await page.$eval('meta[property="og:site_name"], meta[name="application-name"]', (el: any) => el?.getAttribute('content') ,).catch(()=>null);
//     if (siteName) lead.company = siteName;

//     // collect page text and HTML to run extractors
//     const bodyText = await page.evaluate(() => document.body ? document.body.innerText : "");
//     const html = await page.content();

//     // extract emails/phones
//     lead.emails = extractAll(emailRegex, html + "\n" + bodyText);
//     lead.phones = extractAll(phoneRegex, bodyText).filter(p => p.replace(/\D/g,'').length >= 6); // basic filter

//     // addresses (naive: look for patterns like 'Address' lines or <address> tags)
//     const addrFromTag = await page.$$eval('address', nodes => nodes.map(n => n.innerText.trim())).catch(()=>[]);
//     if (addrFromTag && addrFromTag.length) lead.addresses = addrFromTag;
//     // simple heuristic for "Address:" in text
//     const addrLines = bodyText.split(/\n/).filter(l => /address[:\s]/i.test(l)).slice(0,3);
//     lead.addresses = [...new Set([...(lead.addresses || []), ...addrLines])];

//     // social links (facebook, linkedin, instagram, twitter)
//     const social = await page.$$eval('a[href]', (as) => as.map(a => a.getAttribute('href')));
//     const socialFiltered = Array.from(new Set(social.filter(Boolean) as string[])).filter(h =>
//       /facebook\.com|linkedin\.com|instagram\.com|twitter\.com|tiktok\.com/i.test(h)
//     );
//     lead.socialLinks = socialFiltered;

//     // fallback company extraction: domain name or H1
//     if (!lead.company) {
//       const h1 = await page.$eval('h1', el => el?.textContent?.trim()).catch(()=>null);
//       if (h1) lead.company = h1;
//       else lead.company = new URL(lead.finalUrl || target).hostname.replace('www.','');
//     }

//     lead.notes = "OK";
//   } catch (err: any) {
//     lead.notes = `Error: ${err.message?.slice(0,200)}`;
//   } finally {
//     try { await page.close(); } catch(e) { /* ignore */ }
//   }

//   return lead;
// }

// async function run() {
//   // input: domains.txt (one URL per line) or sample list
//   const inputPath = process.argv[2] || "domains.txt";
//   let targets: string[] = [];
//   if (fs.existsSync(inputPath)) {
//     targets = fs.readFileSync(inputPath, "utf-8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
//   } else {
//     console.warn(`Input file ${inputPath} not found — using sample list.`);
//     targets = ["https://example.com"];
//   }

//   // config
//   const concurrency = 3;
//   const perPageTimeoutMs = 30000;
//   const headless = true; // set false for debug
//   const slowMo = 0; // increase to slow puppeteer for debugging

//   // launch
//   const browser = await puppeteerExtra.launch({ headless, args: ["--no-sandbox","--disable-setuid-sandbox"], slowMo });

//   // queue
//   const queue = new PQueue({ concurrency });

//   const results: Lead[] = [];

//   for (const t of targets) {
//     queue.add(async () => {
//       console.log("Scraping:", t);
//       const lead = await scrapeOne(browser as unknown as puppeteer.Browser, t, { timeoutMs: perPageTimeoutMs });
//       console.log(" =>", lead.emails?.slice(0,3) || [], lead.phones?.slice(0,2) || [], lead.notes);
//       results.push(lead);
//       // polite pause
//       await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
//     });
//   }

//   await queue.onIdle();
//   await browser.close();

//   // write CSV
//   const rows = results.map(r => ({
//     ...r,
//     emails: (r.emails || []).join("; "),
//     phones: (r.phones || []).join("; "),
//     addresses: (r.addresses || []).join(" | "),
//     socialLinks: (r.socialLinks || []).join("; ")
//   }));
//   await csvWriter.writeRecords(rows);
//   console.log("Saved leads.csv with", rows.length, "rows");
// }

// run().catch(err => {
//   console.error("Fatal:", err);
//   process.exit(1);
// });
