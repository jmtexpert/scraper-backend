import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserAgent from 'user-agents';

// Use puppeteer-extra with stealth plugin
puppeteer.use(StealthPlugin());

export async function scrapeYelpStealth(term: string, location: string) {
  console.log("🚀 Starting Yelp scraper with stealth...");
  

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: { width: 1280, height: 800 },
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
    // Proxy if needed:
    // '--proxy-server=YOUR_RESIDENTIAL_PROXY'
  ],
});


  const page = await browser.newPage();
  
  // Generate random user agent
  const userAgent = new UserAgent({ deviceCategory: 'desktop' });
  const userAgentString = userAgent.toString();
  await page.setUserAgent(userAgentString);
  console.log("🤖 Using User Agent:", userAgentString);
  
  // Additional stealth evasions (FIXED VERSION)
  await page.evaluateOnNewDocument(() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Override languages property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Override plugins property
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Mock Chrome runtime (important for Chrome detection)
    if (!('chrome' in window)) {
      (window as any).chrome = {
        runtime: {},
      };
    }

    // Remove automation痕迹
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
  });

  const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(term)}&find_loc=${encodeURIComponent(location)}`;
  console.log("🔍 Opening with stealth:", url);

  try {
    // Add random mouse movements before navigation
    await page.mouse.move(Math.random() * 100, Math.random() * 100);
    
    await page.goto(url, { 
      waitUntil: "networkidle2", 
      timeout: 60000 
    });

    // Check if we're blocked
    const isBlocked = await page.evaluate(() => {
      const title = document.title.toLowerCase();
      const bodyText = document.body.textContent?.toLowerCase() || '';
      const html = document.documentElement.outerHTML.toLowerCase();
      
      return title.includes('blocked') || 
             title.includes('access denied') ||
             title.includes('unusual traffic') ||
             bodyText.includes('captcha') ||
             bodyText.includes('bot') ||
             bodyText.includes('suspicious') ||
             html.includes('cf-browser-verification');
    });

    if (isBlocked) {
      console.log("❌ Blocked detected, trying alternative approach...");
      return await alternativeApproach(browser, term, location);
    }

    console.log("✅ Successfully bypassed blocking");
    
    // Wait for content with multiple selector options
    try {
      await page.waitForSelector('a[href*="/biz/"]', { timeout: 10000 });
    } catch (error) {
      console.log("⏳ No business links found, waiting longer...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const data = await page.evaluate(() => {
      const results: any[] = [];
      
      // Get all business links
      const bizLinks = document.querySelectorAll('a[href*="/biz/"]');
      
      bizLinks.forEach((link, index) => {
        try {
          const name = link.textContent?.trim();
          const href = (link as HTMLAnchorElement).href;
          
          if (name && name.length > 2 && href.includes('/biz/')) {
            // Find the card container
            const card = link.closest('li, div, article, section') || document;
            
            // Get rating
            let rating = '';
            const ratingSelectors = [
              '[aria-label*="star rating"]',
              'div[role="img"][aria-label*="star"]',
              '[class*="rating"]'
            ];
            
            for (const selector of ratingSelectors) {
              const ratingEl = card.querySelector(selector);
              if (ratingEl?.getAttribute('aria-label')) {
                rating = ratingEl.getAttribute('aria-label') || '';
                break;
              }
            }
            
            // Get reviews
            let reviews = '';
            const reviewSelectors = [
              'span[class*="reviewCount"]',
              '[class*="review"]',
              'span:contains("review")'
            ];
            
            for (const selector of reviewSelectors) {
              const reviewEl = card.querySelector(selector);
              if (reviewEl?.textContent) {
                reviews = reviewEl.textContent.trim();
                break;
              }
            }
            
            // Get address
            let address = '';
            const addressSelectors = [
              'address',
              '[class*="address"]',
              '[class*="location"]'
            ];
            
            for (const selector of addressSelectors) {
              const addressEl = card.querySelector(selector);
              if (addressEl?.textContent) {
                address = addressEl.textContent.trim();
                break;
              }
            }
            
            // Get phone
            let phone = '';
            const phoneSelectors = [
              '[class*="phone"]',
              'span[class*="phone"]'
            ];
            
            for (const selector of phoneSelectors) {
              const phoneEl = card.querySelector(selector);
              if (phoneEl?.textContent) {
                phone = phoneEl.textContent.trim();
                break;
              }
            }
            
            results.push({
              name,
              rating: rating || 'Not found',
              reviews: reviews || 'Not found',
              address: address || 'Not found',
              phone: phone || 'Not found',
              link: href,
              index
            });
          }
        } catch (error) {
          console.log(`Error processing business ${index}:`, error);
        }
      });
      
      return results;
    });

    console.log(`✅ Found ${data.length} businesses`);
    
    if (data.length === 0) {
      console.log("⚠️ No businesses found. Taking screenshot for debugging...");
      await page.screenshot({ path: 'debug-no-results.png' });
    } else {
      console.table(data.slice(0, 5)); // Show first 5 results
    }
    
    return data;

  } catch (error) {
    console.error("❌ Error in main approach:", error);
    // Try alternative approach if main fails
    return await alternativeApproach(browser, term, location);
  } finally {
    await browser.close();
  }
}

async function alternativeApproach(browser: any, term: string, location: string) {
  console.log("🔄 Starting alternative approach...");
  
  const page = await browser.newPage();
  
  try {
    // Use a different user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    // Navigate to homepage first
    console.log("🌐 Going to Yelp homepage first...");
    await page.goto('https://www.yelp.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait like a human
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Now go to search
    const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(term)}&find_loc=${encodeURIComponent(location)}`;
    console.log("🔍 Navigating to Yelp search...");
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait longer for JavaScript to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Simple data extraction as fallback
    const data = await page.evaluate(() => {
      const results: any[] = [];
      const bizLinks = document.querySelectorAll('a[href*="/biz/"]');
      
      bizLinks.forEach((link, index) => {
        const name = link.textContent?.trim();
        if (name && name.length > 2) {
          results.push({
            name,
            link: (link as HTMLAnchorElement).href,
            index,
            source: 'alternative_approach'
          });
        }
      });
      
      return results;
    });
    
    console.log(`✅ Alternative approach found ${data.length} businesses`);
    return data;
    
  } catch (error) {
    console.error("❌ Alternative approach also failed:", error);
    return [];
  }
}