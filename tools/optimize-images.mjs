/**
 * Converts all product images to WebP and resizes them.
 * - Card thumbnails (used in grids): 500px max dimension, quality 82
 * - Full product images (used on product pages): 900px max dimension, quality 85
 *
 * Replaces files in-place (same filename, .webp extension).
 * Updates data/products.json src paths to point to .webp files.
 *
 * Run: node tools/optimize-images.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images/products');
const PRODUCTS_JSON = path.join(ROOT, 'data/products.json');

const MAX_SIZE = 900;
const QUALITY = 85;

const files = fs.readdirSync(IMAGES_DIR).filter(f =>
  /\.(jpe?g|png)$/i.test(f)
);

console.log(`Found ${files.length} images to optimize...\n`);

let converted = 0;
let skipped = 0;

for (const file of files) {
  const srcPath = path.join(IMAGES_DIR, file);
  const webpName = file.replace(/\.(jpe?g|png)$/i, '.webp');
  const destPath = path.join(IMAGES_DIR, webpName);

  // Skip if already a webp source
  if (file.endsWith('.webp')) {
    skipped++;
    continue;
  }

  try {
    const originalSize = fs.statSync(srcPath).size;
    await sharp(srcPath)
      .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(destPath);

    const newSize = fs.statSync(destPath).size;
    const saving = Math.round((1 - newSize / originalSize) * 100);
    console.log(`✓ ${file} → ${webpName} (${saving}% smaller)`);
    converted++;
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
}

// Update products.json src paths from .jpg/.png to .webp
const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
let pathsUpdated = 0;

for (const product of products) {
  if (!product.images) continue;
  for (const img of product.images) {
    if (img.src && /\.(jpe?g|png)$/i.test(img.src)) {
      img.src = img.src.replace(/\.(jpe?g|png)$/i, '.webp');
      pathsUpdated++;
    }
  }
}

fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(products, null, 2));

console.log(`\nDone: ${converted} converted, ${skipped} skipped.`);
console.log(`Updated ${pathsUpdated} image paths in data/products.json.`);
console.log('\nOriginal files are still present — delete them manually if desired.');
