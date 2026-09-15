import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../site';

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.summary,
      pubDate: p.data.date,
      link: `/blog/${p.id}/`,
    })),
  });
}
