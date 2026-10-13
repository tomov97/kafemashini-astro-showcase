import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

const SITEMAP_URL = 'https://kafemashini.ch/product_cat-sitemap.xml';
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getCategoryUrls() {
  const xml = await fetchText(SITEMAP_URL);
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc').each((_, el) => {
    urls.push($(el).text().trim());
  });
  console.log(`Found ${urls.length} category URLs in sitemap`);
  return urls;
}

function extractSlug(url) {
  const match = url.match(/\/kafe-mashini\/(.+?)(?:\/|$)/);
  return match ? match[1] : '';
}

async function scrapeCategory(url) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const slug = extractSlug(url);

  // Display name
  const displayName = $('h1.woocommerce-products-header__title, h1.page-title, h1').first().text().trim()
    || slug.toUpperCase();

  // Description
  const description = $('.term-description, .woocommerce-products-header__description, .archive-description')
    .first().text().trim()
    || '';

  // Meta
  const metaTitle = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  // Count products listed on all pages
  let productSlugs = [];

  // Get products from current page
  $('a.woocommerce-LoopProduct-link, .products a[href*="/produkt/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/produkt\/(.+?)(?:\/|$)/);
    if (match && !productSlugs.includes(match[1])) {
      productSlugs.push(match[1]);
    }
  });

  // Check for pagination and scrape additional pages
  const paginationLinks = $('.woocommerce-pagination a.page-numbers, .pagination a');
  const pageUrls = new Set();
  paginationLinks.each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.includes('#')) {
      pageUrls.add(href);
    }
  });

  for (const pageUrl of pageUrls) {
    try {
      await sleep(DELAY_MS);
      const pageHtml = await fetchText(pageUrl);
      const $page = cheerio.load(pageHtml);
      $page('a.woocommerce-LoopProduct-link, .products a[href*="/produkt/"]').each((_, el) => {
        const href = $page(el).attr('href') || '';
        const match = href.match(/\/produkt\/(.+?)(?:\/|$)/);
        if (match && !productSlugs.includes(match[1])) {
          productSlugs.push(match[1]);
        }
      });
    } catch (err) {
      console.warn(`  Warning: failed to fetch pagination page ${pageUrl}: ${err.message}`);
    }
  }

  return {
    slug,
    displayName,
    description,
    metaTitle,
    metaDescription,
    productCount: productSlugs.length,
    productSlugs,
  };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const urls = await getCategoryUrls();
  const brands = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const slug = extractSlug(url);
    console.log(`[${i + 1}/${urls.length}] Scraping category: ${slug}...`);

    try {
      const brand = await scrapeCategory(url);
      brands.push(brand);
      console.log(`  Found ${brand.productCount} products, display name: "${brand.displayName}"`);
    } catch (err) {
      console.error(`  ERROR: Failed to scrape ${slug}: ${err.message}`);
    }

    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  const outPath = resolve(DATA_DIR, 'brands.json');
  writeFileSync(outPath, JSON.stringify(brands, null, 2), 'utf-8');
  console.log(`\nDone! Saved ${brands.length} brands to ${outPath}`);

  const totalProducts = brands.reduce((sum, b) => sum + b.productCount, 0);
  console.log(`Total products across all brands: ${totalProducts}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
