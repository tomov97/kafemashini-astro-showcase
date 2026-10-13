import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

function main() {
  let issues = 0;

  // Validate products
  console.log('=== Validating products.json ===\n');
  const productsPath = resolve(DATA_DIR, 'products.json');
  if (!existsSync(productsPath)) {
    console.error('ERROR: products.json not found! Run scrape-products.mjs first.');
    process.exit(1);
  }

  const products = JSON.parse(readFileSync(productsPath, 'utf-8'));
  console.log(`Total products: ${products.length}`);

  for (const p of products) {
    const prefix = `  [${p.slug}]`;
    if (!p.name) { console.warn(`${prefix} MISSING: name`); issues++; }
    if (!p.price) { console.warn(`${prefix} MISSING: price`); issues++; }
    if (!p.brand) { console.warn(`${prefix} MISSING: brand`); issues++; }
    if (!p.description) { console.warn(`${prefix} MISSING: description`); issues++; }
    if (!p.images || p.images.length === 0) { console.warn(`${prefix} MISSING: images`); issues++; }
    if (Object.keys(p.specs || {}).length === 0) { console.warn(`${prefix} MISSING: specs`); issues++; }

    // Check related slugs reference valid products
    for (const rel of (p.relatedSlugs || [])) {
      if (!products.find(pp => pp.slug === rel)) {
        console.warn(`${prefix} BROKEN RELATED: "${rel}" not found in products`);
        issues++;
      }
    }
  }

  // Brand distribution
  const brandCounts = {};
  for (const p of products) {
    const b = p.brand || 'UNKNOWN';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  }
  console.log('\nProducts per brand:');
  Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}`);
  });

  // Validate brands
  console.log('\n=== Validating brands.json ===\n');
  const brandsPath = resolve(DATA_DIR, 'brands.json');
  if (!existsSync(brandsPath)) {
    console.error('ERROR: brands.json not found! Run scrape-categories.mjs first.');
    process.exit(1);
  }

  const brands = JSON.parse(readFileSync(brandsPath, 'utf-8'));
  console.log(`Total brands: ${brands.length}`);

  for (const b of brands) {
    const prefix = `  [${b.slug}]`;
    if (!b.displayName) { console.warn(`${prefix} MISSING: displayName`); issues++; }
    if (!b.description) { console.warn(`${prefix} MISSING: description`); issues++; }
    if (b.productCount === 0) { console.warn(`${prefix} WARNING: 0 products`); issues++; }
  }

  // Cross-reference brands with products
  const productBrands = new Set(products.map(p => p.brand).filter(Boolean));
  const brandSlugs = new Set(brands.map(b => b.slug));

  for (const pb of productBrands) {
    if (!brandSlugs.has(pb)) {
      console.warn(`  WARNING: Product brand "${pb}" has no matching brand in brands.json`);
      issues++;
    }
  }

  // Validate site config
  console.log('\n=== Validating site.json ===\n');
  const sitePath = resolve(DATA_DIR, 'site.json');
  if (!existsSync(sitePath)) {
    console.error('ERROR: site.json not found!');
    process.exit(1);
  }
  const site = JSON.parse(readFileSync(sitePath, 'utf-8'));
  if (!site.phone) { console.warn('  MISSING: phone'); issues++; }
  if (!site.email) { console.warn('  MISSING: email'); issues++; }
  if (!site.navigation) { console.warn('  MISSING: navigation'); issues++; }
  console.log('  site.json OK');

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  if (issues === 0) {
    console.log('All validations passed!');
  } else {
    console.log(`Found ${issues} issue(s) — review warnings above.`);
  }
}

main();
