/**
 * Extract structured specs from product descriptions.
 *
 * Parses known Bulgarian spec patterns from description text
 * and populates the specs object for products that have
 * specs embedded in their descriptions but empty specs fields.
 *
 * Usage: node tools/extract-embedded-specs.mjs [--dry-run]
 *
 * --dry-run: Print what would change without writing to products.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = resolve(__dirname, '..', 'data', 'products.json');

const dryRun = process.argv.includes('--dry-run');

// Spec extraction patterns — order matters (more specific first)
// Each pattern: [specKey, regex, optional transform function]
const SPEC_PATTERNS = [
  // Power (Мощност)
  ['Мощност', /(?:Mощност|Мощност)[:\s–-]*(\d[\d.,]*\s*W)/i],

  // Pump pressure (Налягане)
  ['Налягане', /(?:Налягане(?:\s+на\s+помпата)?)[:\s–-]*([\d.,]+\s*бара?)/i],
  ['Налягане', /([\d.,]+)\s*бара?\s+налягане/i, (m) => `${m[1]} бара`],

  // Water tank (Воден резервоар)
  ['Воден резервоар', /(?:Вместимост на\s+)?(?:резервоар(?:а|ът)?\s+за\s+вода|воден резервоар|контейнер(?:а)?\s+за\s+вода|капацитет(?:ът)?\s+на\s+(?:контейнера|резервоара)\s+за\s+вода)[:\s–-]*([\d.,]+\s*л\.?)/i],
  ['Воден резервоар', /(?:воден\s+резервоар|резервоар\s+за\s+вода)\s+([\d.,]+\s*л\.?)/i],

  // Bean hopper (Контейнер за кафе)
  ['Контейнер за кафе', /(?:Вместимост на\s+)?(?:контейнер(?:а)?\s+за\s+кафе(?:\s+на\s+зърна)?|резервоар(?:а|ът)?\s+(?:на\s+контейнера\s+)?за\s+кафе(?:\s+на\s+зърна)?|капацитет(?:ът)?\s+на\s+(?:контейнера|резервоара)\s+за\s+кафе(?:\s+на\s+зърна)?|вместимост\s+за\s+кафе\s+на\s+зърна)[:\s–-]*([\d.,][\d.,-]*\s*(?:гр\.?|грама?))/i],
  ['Контейнер за кафе', /(?:Вместимост|Капацитет)\s+([\d.,]+)\s*(?:гр\.?|грама?)\s+кафе/i, (m) => `${m[1]} гр.`],

  // Dimensions (Размери)
  ['Размери', /Размери[:\s–-]*\(?([^)\n]+(?:мм|mm))\)?/i],
  ['Размери', /(\d{2,3}\s*[xхX×]\s*\d{2,3}\s*[xхX×]\s*\d{2,3}\s*мм)/i],

  // Weight (Тегло)
  ['Тегло', /Тегло[:\s–-]*([\d.,]+\s*кг\.?)/i],

  // Voltage (Напрежение)
  ['Напрежение', /Напрежение[:\s–-]*([\d.,]+\s*V)/i],

  // Frequency (Честота)
  ['Честота', /Честота[:\s–-]*([\d.,]+\s*Hz)/i],

  // Milk container (Кана за мляко)
  ['Кана за мляко', /(?:Вместимост на\s+)?(?:каната?\s+за\s+мляко)[:\s–-]*([\d.,]+\s*л\.?)/i],

  // Waste container (Контейнер за отпадъци)
  ['Контейнер за отпадъци', /(?:Вместимост на\s+)?(?:контейнер(?:а)?\s+за\s+отпадъци)[:\s–-]*([\d.,]+)/i],
  ['Контейнер за отпадъци', /отпадъци\s+([\d]+)\s*(?:бр\.?|дози)/i, (m) => `${m[1]} дози`],
];

function extractSpecs(description) {
  const specs = {};

  for (const [key, pattern, transform] of SPEC_PATTERNS) {
    // Don't overwrite if we already found this spec with a more specific pattern
    if (specs[key]) continue;

    const match = description.match(pattern);
    if (match) {
      if (transform) {
        specs[key] = transform(match);
      } else {
        // Use first capture group
        specs[key] = match[1].trim();
      }
    }
  }

  return specs;
}

function main() {
  const products = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));

  let extractedCount = 0;
  let totalNewSpecs = 0;
  const changes = [];

  for (const product of products) {
    const existingSpecCount = Object.keys(product.specs || {}).length;
    const extracted = extractSpecs(product.description || '');
    const newSpecs = {};

    // Only add specs that don't already exist
    for (const [key, value] of Object.entries(extracted)) {
      if (!product.specs?.[key]) {
        newSpecs[key] = value;
      }
    }

    if (Object.keys(newSpecs).length > 0) {
      extractedCount++;
      totalNewSpecs += Object.keys(newSpecs).length;

      changes.push({
        slug: product.slug,
        existingSpecs: existingSpecCount,
        newSpecs,
      });

      if (!dryRun) {
        product.specs = { ...product.specs, ...newSpecs };
      }
    }
  }

  // Report
  console.log(`\n=== Spec Extraction Report ===\n`);

  if (changes.length === 0) {
    console.log('No new specs found to extract.');
    return;
  }

  for (const change of changes) {
    console.log(`📦 ${change.slug} (had ${change.existingSpecs} specs):`);
    for (const [key, value] of Object.entries(change.newSpecs)) {
      console.log(`   + ${key}: ${value}`);
    }
    console.log('');
  }

  console.log(`--- Summary ---`);
  console.log(`Products updated: ${extractedCount}`);
  console.log(`New specs extracted: ${totalNewSpecs}`);

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN — no changes written. Run without --dry-run to apply.`);
  } else {
    writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
    console.log(`\n✅ Written to ${PRODUCTS_FILE}`);
  }
}

main();
