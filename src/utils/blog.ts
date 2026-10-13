import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());
}

// Inverts each post's relatedProducts frontmatter into a product -> articles lookup,
// so a product page always reflects whatever the blog collection currently declares —
// no per-product/per-brand link to maintain by hand.
export async function getArticlesForProduct(productSlug: string): Promise<BlogPost[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.relatedProducts.includes(productSlug));
}
