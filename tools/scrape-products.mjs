import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

const SITEMAP_URL = 'https://kafemashini.ch/product-sitemap.xml';
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getProductUrls() {
  const xml = await fetchText(SITEMAP_URL);
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc').each((_, el) => {
    urls.push($(el).text().trim());
  });
  console.log(`Found ${urls.length} product URLs in sitemap`);
  return urls;
}

function extractSlug(url) {
  const match = url.match(/\/produkt\/(.+?)(?:\/|$)/);
  return match ? match[1] : '';
}

function parsePrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function scrapeProduct(url) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const slug = extractSlug(url);

  // Extract name
  const name = $('h1.product_title, h1.entry-title, h1').first().text().trim();

  // Extract prices
  let price = null;
  let priceEur = null;
  let originalPrice = null;
  let onSale = false;

  // Check for sale price
  const insPrice = $('.price ins .amount, .price ins .woocommerce-Price-amount').first().text();
  const delPrice = $('.price del .amount, .price del .woocommerce-Price-amount').first().text();
  const regularPrice = $('.price .amount, .price .woocommerce-Price-amount').first().text();

  if (insPrice && delPrice) {
    price = parsePrice(insPrice);
    originalPrice = parsePrice(delPrice);
    onSale = true;
  } else {
    price = parsePrice(regularPrice);
  }

  // Try to find EUR price
  const priceHtml = $('.price').html() || '';
  const eurMatch = priceHtml.match(/€\s*([\d.,]+)/);
  if (eurMatch) {
    priceEur = parsePrice(eurMatch[1]);
  } else if (price) {
    // Calculate approximate EUR (BGN/EUR ~1.956)
    priceEur = Math.round((price / 1.9558) * 100) / 100;
  }

  // Extract description and specs — try multiple sources

  // Source 1: JSON-LD schema
  let schemaDescription = '';
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).html());
      if (data['@type'] === 'Product' && data.description) {
        schemaDescription = data.description.trim();
      }
    } catch {}
  });

  // Source 2: Tab content (#tab-description)
  const tabDescription = $('#tab-description, .woocommerce-Tabs-panel--description, [id*="tab-description"]')
    .first().text().trim();

  // Source 3: Short description
  const shortDescription = $('.woocommerce-product-details__short-description, .product-short-description')
    .first().text().trim();

  // Source 4: itemprop
  const itempropDesc = $('[itemprop="description"]').first().text().trim();

  // Source 5: Full page text extraction for description area
  const productContentText = $('.woocommerce-tabs, .product_meta, .entry-content, .product .description')
    .first().text().trim();

  // Use the best available description
  const description = schemaDescription || tabDescription || shortDescription || itempropDesc || '';

  // Extract specs — try table first, then parse from description text
  const specs = {};

  // Try structured table
  $('.woocommerce-product-attributes tr, .shop_attributes tr, .additional_information tr').each((_, row) => {
    const key = $(row).find('th, td:first-child').first().text().trim();
    const val = $(row).find('td:last-child, td:nth-child(2)').first().text().trim();
    if (key && val && key !== val) {
      specs[key] = val;
    }
  });

  // If no specs from table, try to parse from description text
  if (Object.keys(specs).length === 0) {
    const fullText = description || productContentText || '';
    // Parse Bulgarian spec patterns like "»Мощност: 1900 W" or "Мощност – 1900 W"
    const specPatterns = [
      /(?:»|►|•|\*)\s*(?:Мощност|Power)[:\s–-]+(.+)/i,
      /(?:»|►|•|\*)\s*(?:Дисплей|Display)[:\s–-]+(.+)/i,
      /(?:»|►|•|\*)\s*(?:Воден резервоар|Water tank|Резервоар за вода)[:\s–-]+(.+)/i,
      /(?:»|►|•|\*)\s*(?:Налягане|Pressure|Помпа)[:\s–-]+(.+)/i,
      /(?:»|►|•|\*)\s*(?:Контейнер за кафе|Coffee bean|Кафе зърна)[:\s–-]+(.+)/i,
      /(?:»|►|•|\*)\s*(?:Размери|Dimensions|Ш\/В\/Д)[:\s–-]+(.+)/i,
      /(?:»|►|•|\*)\s*(?:Тегло|Weight)[:\s–-]+(.+)/i,
    ];

    const specNames = ['Мощност', 'Дисплей', 'Воден резервоар', 'Налягане', 'Контейнер за кафе', 'Размери', 'Тегло'];

    specPatterns.forEach((pattern, idx) => {
      const match = fullText.match(pattern);
      if (match) {
        specs[specNames[idx]] = match[1].trim().replace(/\s+/g, ' ');
      }
    });
  }

  // Extract images
  const images = [];
  const ogImage = $('meta[property="og:image"]').attr('content');

  $('.woocommerce-product-gallery img, .wp-post-image, .product img').each((_, img) => {
    let src = $(img).attr('data-large_image') || $(img).attr('data-src') || $(img).attr('src') || '';
    if (src && !src.includes('placeholder') && !src.includes('woocommerce-placeholder')) {
      // Get full-size image
      src = src.replace(/-\d+x\d+\./, '.');
      if (!images.find(i => i.src === src)) {
        images.push({
          src,
          alt: $(img).attr('alt') || `${name} кафе машина`,
          isMain: images.length === 0
        });
      }
    }
  });

  if (images.length === 0 && ogImage) {
    images.push({
      src: ogImage,
      alt: `${name} кафе машина`,
      isMain: true
    });
  }

  // Extract brand from breadcrumbs or categories
  let brand = '';
  let brandDisplayName = '';

  // Try breadcrumbs
  const breadcrumbLinks = $('.woocommerce-breadcrumb a, [typeof="BreadcrumbList"] a');
  breadcrumbLinks.each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/kafe-mashini\/(.+?)(?:\/|$)/);
    if (match) {
      brand = match[1];
      brandDisplayName = $(el).text().trim();
    }
  });

  // Try schema.org JSON-LD
  if (!brand) {
    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const data = JSON.parse($(script).html());
        if (data['@type'] === 'BreadcrumbList' && data.itemListElement) {
          for (const item of data.itemListElement) {
            const itemUrl = item.item?.['@id'] || item.item || '';
            const catMatch = itemUrl.match(/\/kafe-mashini\/(.+?)(?:\/|$)/);
            if (catMatch) {
              brand = catMatch[1];
              brandDisplayName = item.name || '';
            }
          }
        }
      } catch {}
    });
  }

  // Fallback: try product_cat terms
  if (!brand) {
    const catLink = $('a[rel="tag"]').first();
    if (catLink.length) {
      const href = catLink.attr('href') || '';
      const match = href.match(/\/kafe-mashini\/(.+?)(?:\/|$)/);
      if (match) {
        brand = match[1];
        brandDisplayName = catLink.text().trim();
      }
    }
  }

  // Stock status
  let inStock = true;
  const stockText = $('.stock, .availability').text().toLowerCase();
  if (stockText.includes('няма') || stockText.includes('out of stock') || stockText.includes('не е налич')) {
    inStock = false;
  }
  // Also check schema
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).html());
      if (data['@type'] === 'Product' && data.offers) {
        const avail = data.offers.availability || '';
        if (avail.includes('OutOfStock')) inStock = false;
      }
    } catch {}
  });

  // Related products
  const relatedSlugs = [];
  $('.related.products a.woocommerce-LoopProduct-link, .related a[href*="/produkt/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const relSlug = extractSlug(href);
    if (relSlug && !relatedSlugs.includes(relSlug)) {
      relatedSlugs.push(relSlug);
    }
  });

  // Manual PDF link
  let manualUrl = null;
  $('a[href$=".pdf"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.toLowerCase().includes('instruk') || href.toLowerCase().includes('manual')) {
      manualUrl = href;
    }
  });

  // Meta
  const metaTitle = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  return {
    slug,
    name,
    brand,
    brandDisplayName,
    price,
    priceEur,
    originalPrice,
    currency: 'BGN',
    inStock,
    onSale,
    warranty: '12 месеца',
    description,
    specs,
    images,
    manualUrl,
    relatedSlugs,
    metaTitle,
    metaDescription,
  };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const urls = await getProductUrls();
  const products = [];
  let errors = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const slug = extractSlug(url);
    console.log(`[${i + 1}/${urls.length}] Scraping ${slug}...`);

    try {
      const product = await scrapeProduct(url);
      products.push(product);

      if (!product.name) console.warn(`  WARNING: No name found for ${slug}`);
      if (!product.price) console.warn(`  WARNING: No price found for ${slug}`);
      if (!product.brand) console.warn(`  WARNING: No brand found for ${slug}`);
      if (product.images.length === 0) console.warn(`  WARNING: No images found for ${slug}`);
    } catch (err) {
      console.error(`  ERROR: Failed to scrape ${slug}: ${err.message}`);
      errors.push({ slug, url, error: err.message });
    }

    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  const outPath = resolve(DATA_DIR, 'products.json');
  writeFileSync(outPath, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`\nDone! Saved ${products.length} products to ${outPath}`);

  if (errors.length > 0) {
    console.log(`\n${errors.length} errors:`);
    errors.forEach(e => console.log(`  - ${e.slug}: ${e.error}`));
  }

  // Summary
  const withBrand = products.filter(p => p.brand).length;
  const withPrice = products.filter(p => p.price).length;
  const withImages = products.filter(p => p.images.length > 0).length;
  console.log(`\nSummary: ${withBrand}/${products.length} have brand, ${withPrice}/${products.length} have price, ${withImages}/${products.length} have images`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
