import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../data/site';
import { getPosts } from '../lib/content';

/**
 * 订阅源。文件名沿用旧站的 /feed_rss_created.xml —— 换地址等于让订阅者重订一次。
 * 只收三个流水栏目；影像不进 Feed（它不是"更新"）。
 */
export async function GET(context: APIContext) {
  const posts = (await getPosts()).slice(0, 20);

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.title,
      pubDate: post.date,
      description: post.summary,
      link: post.url,
      categories: post.tags,
      author: SITE.author,
    })),
    customData: '<language>zh-cn</language>',
  });
}
