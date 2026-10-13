import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const IMAGES_DIR = resolve(__dirname, '..', 'public', 'images', 'products');
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  return buffer.length;
}

async function main() {
  mkdirSync(IMAGES_DIR, { recursive: true });

  const products = JSON.parse(readFileSync(resolve(DATA_DIR, 'products.json'), 'utf-8'));
  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (!product.images || product.images.length === 0) {
      console.log(`[${i + 1}/${products.length}] ${product.slug}: no images, skipping`);
      skipped++;
      continue;
    }

    const mainImage = product.images.find(img => img.isMain) || product.images[0];
    const srcUrl = mainImage.src;

    if (!srcUrl || !srcUrl.startsWith('http')) {
      console.log(`[${i + 1}/${products.length}] ${product.slug}: invalid image URL "${srcUrl}", skipping`);
      skipped++;
      continue;
    }

    // Determine extension from URL
    const extMatch = srcUrl.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
    const filename = `${product.slug}.${ext}`;
    const destPath = resolve(IMAGES_DIR, filename);

    console.log(`[${i + 1}/${products.length}] Downloading ${product.slug}...`);

    try {
      const size = await downloadImage(srcUrl, destPath);
      console.log(`  Saved: ${filename} (${Math.round(size / 1024)}KB)`);

      // Update the product's image path to local
      product.images[0] = {
        ...mainImage,
        src: `/images/products/${filename}`,
        originalSrc: srcUrl,
      };

      downloaded++;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      failed++;
    }

    if (i < products.length - 1) await sleep(DELAY_MS);
  }

  // Save updated products.json with local image paths
  writeFileSync(resolve(DATA_DIR, 'products.json'), JSON.stringify(products, null, 2), 'utf-8');

  console.log(`\nDone! Downloaded: ${downloaded}, Failed: ${failed}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
