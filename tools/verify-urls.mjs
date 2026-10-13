import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist');

// All URLs that must exist in the build output
const EXPECTED_URLS = [
  // Homepage
  { path: '/index.html', label: 'Homepage' },

  // Info pages with .html extension
  { path: '/about.html', label: 'About' },
  { path: '/contact.html', label: 'Contact' },
  { path: '/garantsiya.html', label: 'Warranty' },
  { path: '/serviz-na-kafe-mashini.html', label: 'Service' },
  { path: '/istoria_na_kafe_mashinite.html', label: 'History' },
  { path: '/kafe_mashini.html', label: 'Coffee Machines' },
  { path: '/produkti.html', label: 'Products' },

  // Info pages without .html (Astro build.format: file produces .html)
  { path: '/biskvitki.html', label: 'Cookies' },
  { path: '/cookie-policy.html', label: 'Cookie Policy' },
  { path: '/zashtita-na-lichnite-danni.html', label: 'Privacy' },
  { path: '/uslovia.html', label: 'Terms' },

  // Nested
  { path: '/produkti/instruktsii-za-upotreba.html', label: 'Instructions' },

  // 404
  { path: '/404.html', label: '404 page' },
];

function main() {
  // Load product and brand data
  const products = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'products.json'), 'utf-8'));
  const brands = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'brands.json'), 'utf-8'));

  // Add product URLs
  for (const p of products) {
    EXPECTED_URLS.push({ path: `/produkt/${p.slug}.html`, label: `Product: ${p.name}` });
  }

  // Add brand category URLs
  for (const b of brands) {
    EXPECTED_URLS.push({ path: `/kafe-mashini/${b.slug}.html`, label: `Brand: ${b.displayName}` });
  }

  console.log(`Verifying ${EXPECTED_URLS.length} URLs in build output...\n`);

  let passed = 0;
  let failed = 0;

  for (const url of EXPECTED_URLS) {
    const filePath = resolve(DIST_DIR, url.path.replace(/^\//, ''));
    let exists = false;
    try {
      readFileSync(filePath);
      exists = true;
    } catch {}

    if (exists) {
      passed++;
    } else {
      console.log(`FAIL: ${url.path} (${url.label})`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Passed: ${passed}/${EXPECTED_URLS.length}`);
  if (failed > 0) {
    console.log(`FAILED: ${failed} URL(s) missing from build output`);
    process.exit(1);
  } else {
    console.log('All URLs verified!');
  }

  // Also check sitemap exists
  const sitemapPath = resolve(DIST_DIR, 'sitemap-index.xml');
  try {
    readFileSync(sitemapPath);
    console.log('Sitemap: OK');
  } catch {
    console.log('WARNING: sitemap-index.xml not found');
  }

  // Check robots.txt
  const robotsPath = resolve(DIST_DIR, 'robots.txt');
  try {
    readFileSync(robotsPath);
    console.log('robots.txt: OK');
  } catch {
    console.log('WARNING: robots.txt not found');
  }
}

main();
