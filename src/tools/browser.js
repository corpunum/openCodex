/**
 * Browser Automation Tool
 * Auto-approved: web scraping, screenshots, navigation
 */

import { chromium } from 'playwright';

let browser = null;

export async function execute(args) {
  const { action, url, selector, timeout = 30000 } = args;
  
  try {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      switch (action) {
        case 'fetch':
          await page.goto(url, { waitUntil: 'networkidle', timeout });
          const content = await page.content();
          return { success: true, content };
        
        case 'screenshot':
          await page.goto(url, { waitUntil: 'networkidle', timeout });
          const screenshot = await page.screenshot({ encoding: 'base64' });
          return { success: true, screenshot };
        
        case 'extract':
          await page.goto(url, { waitUntil: 'networkidle', timeout });
          const text = await page.locator(selector || 'body').textContent();
          return { success: true, text };
        
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } finally {
      await context.close();
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}
