import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog / cluster content. Posts are authored as Markdown in src/content/blog/.
// The SEO engine (.claude/skills/seo-engine) writes these on `publish`.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),                 // meta description
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // Which layer of the topic model this belongs to.
    cluster: z.enum(['repair', 'buying', 'hub']),
    // Money page this article links UP to.
    pillar: z.enum(['/serviz-na-kafe-mashini', '/kak-da-izberete-upotrebyavana-kafemashina']).optional(),
    primaryKeyword: z.string(),
    secondaryKeywords: z.array(z.string()).default([]),
    // First ~200-word direct answer, rendered above the body for humans + AI.
    directAnswer: z.string(),
    // FAQ drives both the visible section and FAQPage schema (single source).
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    // Product slugs this piece links DOWN to (procedural hubs especially).
    relatedProducts: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
