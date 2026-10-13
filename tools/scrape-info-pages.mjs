import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data', 'pages');

const DELAY_MS = 500;

// All info page URLs from the page sitemap (excluding moyat-profil which is WP account page)
const INFO_PAGES = [
  { url: 'https://kafemashini.ch/kafe_mashini.html', slug: 'kafe_mashini' },
  { url: 'https://kafemashini.ch/istoria_na_kafe_mashinite.html', slug: 'istoria_na_kafe_mashinite' },
  { url: 'https://kafemashini.ch/about.html', slug: 'about' },
  { url: 'https://kafemashini.ch/produkti/instruktsii-za-upotreba', slug: 'instruktsii-za-upotreba' },
  { url: 'https://kafemashini.ch/biskvitki', slug: 'biskvitki' },
  { url: 'https://kafemashini.ch/cookie-policy', slug: 'cookie-policy' },
  { url: 'https://kafemashini.ch/zashtita-na-lichnite-danni', slug: 'zashtita-na-lichnite-danni' },
  { url: 'https://kafemashini.ch/produkti.html', slug: 'produkti' },
  { url: 'https://kafemashini.ch/serviz-na-kafe-mashini.html', slug: 'serviz-na-kafe-mashini' },
  { url: 'https://kafemashini.ch/uslovia', slug: 'uslovia' },
  { url: 'https://kafemashini.ch/garantsiya.html', slug: 'garantsiya' },
  { url: 'https://kafemashini.ch/contact.html', slug: 'contact' },
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function htmlToMarkdown($, el) {
  // Simple HTML to markdown conversion for content
  let md = '';
  const $el = $(el);

  // Get inner HTML and do basic conversion
  let html = $el.html() || '';

  // Replace common HTML elements with markdown
  html = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim();

  return html;
}

async function scrapePage(pageInfo) {
  const html = await fetchText(pageInfo.url);
  const $ = cheerio.load(html);

  // Page title
  const h1 = $('h1.entry-title, h1.page-title, h1').first().text().trim();
  const metaTitle = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  // Main content
  const contentEl = $('.entry-content, .page-content, article .content, main').first();
  const contentHtml = contentEl.length ? contentEl : $('article').first();
  const contentMarkdown = contentHtml.length ? htmlToMarkdown($, contentHtml) : '';

  // Get the path portion for canonical URL
  const urlObj = new URL(pageInfo.url);
  const canonicalPath = urlObj.pathname;

  return {
    slug: pageInfo.slug,
    url: pageInfo.url,
    canonicalPath,
    title: h1,
    metaTitle,
    metaDescription,
    content: contentMarkdown,
  };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const results = [];

  for (let i = 0; i < INFO_PAGES.length; i++) {
    const pageInfo = INFO_PAGES[i];
    console.log(`[${i + 1}/${INFO_PAGES.length}] Scraping: ${pageInfo.slug} (${pageInfo.url})...`);

    try {
      const page = await scrapePage(pageInfo);
      results.push(page);

      // Save as individual markdown file with frontmatter
      const md = `---
slug: "${page.slug}"
title: "${page.title}"
canonicalPath: "${page.canonicalPath}"
metaTitle: "${page.metaTitle.replace(/"/g, '\\"')}"
metaDescription: "${page.metaDescription.replace(/"/g, '\\"')}"
---

${page.content}
`;
      const filePath = resolve(DATA_DIR, `${pageInfo.slug}.md`);
      writeFileSync(filePath, md, 'utf-8');
      console.log(`  Saved: ${pageInfo.slug}.md (${page.content.length} chars)`);

      if (!page.title) console.warn(`  WARNING: No h1 found`);
      if (!page.content) console.warn(`  WARNING: No content extracted`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      if (err.message.includes('404')) {
        console.log(`  NOTE: Page returns 404 — may need to create content from scratch`);
      }
    }

    if (i < INFO_PAGES.length - 1) await sleep(DELAY_MS);
  }

  // Save index
  const indexPath = resolve(DATA_DIR, '_index.json');
  writeFileSync(indexPath, JSON.stringify(results.map(r => ({
    slug: r.slug,
    title: r.title,
    canonicalPath: r.canonicalPath,
    contentLength: r.content.length,
  })), null, 2), 'utf-8');

  console.log(`\nDone! Scraped ${results.length}/${INFO_PAGES.length} info pages`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
