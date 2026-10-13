/**
 * Merge enriched specs into products.json.
 *
 * Reads data/specs-enriched.json and merges into data/products.json:
 * - Specs: enriched values overwrite existing ones, existing non-conflicting specs preserved
 * - New fields: series, modelNumber, milkSystem added at product level
 *
 * Usage: node tools/merge-enriched-specs.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = resolve(__dirname, '..', 'data', 'products.json');
const ENRICHED_FILE = resolve(__dirname, '..', 'data', 'specs-enriched.json');

const dryRun = process.argv.includes('--dry-run');

function main() {
  const products = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const enriched = JSON.parse(readFileSync(ENRICHED_FILE, 'utf-8'));

  let updatedCount = 0;
  let newSpecsCount = 0;
  let overwrittenSpecsCount = 0;
  let newFieldsCount = 0;

  for (const product of products) {
    const enrichment = enriched[product.slug];
    if (!enrichment) continue;

    updatedCount++;
    const changes = [];

    // Merge specs
    if (enrichment.specs) {
      if (!product.specs) product.specs = {};

      for (const [key, value] of Object.entries(enrichment.specs)) {
        // Normalize existing key matching (handle slight variations)
        const existingKey = Object.keys(product.specs).find(k =>
          k.replace(/\s*\(.*\)/, '').trim() === key.replace(/\s*\(.*\)/, '').trim()
        );

        if (existingKey) {
          if (product.specs[existingKey] !== value) {
            changes.push(`  ~ ${key}: "${product.specs[existingKey]}" → "${value}"`);
            overwrittenSpecsCount++;
            if (!dryRun) {
              // Remove old key if different from new key
              if (existingKey !== key) delete product.specs[existingKey];
              product.specs[key] = value;
            }
          }
        } else {
          changes.push(`  + ${key}: "${value}"`);
          newSpecsCount++;
          if (!dryRun) {
            product.specs[key] = value;
          }
        }
      }
    }

    // Add new top-level fields
    const newFields = ['series', 'modelNumber', 'milkSystem'];
    for (const field of newFields) {
      if (enrichment[field] !== undefined) {
        if (product[field] !== enrichment[field]) {
          changes.push(`  + ${field}: "${enrichment[field]}"`);
          newFieldsCount++;
          if (!dryRun) {
            product[field] = enrichment[field];
          }
        }
      }
    }

    if (changes.length > 0) {
      console.log(`\n📦 ${product.slug}:`);
      changes.forEach(c => console.log(c));
    }
  }

  // Check for slugs in enriched that aren't in products
  const productSlugs = new Set(products.map(p => p.slug));
  const enrichedSlugs = Object.keys(enriched).filter(k => !k.startsWith('_'));
  const missingSlugs = enrichedSlugs.filter(s => !productSlugs.has(s));
  if (missingSlugs.length > 0) {
    console.log(`\n⚠️  Enriched slugs not found in products: ${missingSlugs.join(', ')}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Products updated: ${updatedCount}`);
  console.log(`New specs added: ${newSpecsCount}`);
  console.log(`Specs overwritten: ${overwrittenSpecsCount}`);
  console.log(`New fields added: ${newFieldsCount}`);

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN — no changes written. Run without --dry-run to apply.`);
  } else {
    writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
    console.log(`\n✅ Written to ${PRODUCTS_FILE}`);
  }
}

main();
