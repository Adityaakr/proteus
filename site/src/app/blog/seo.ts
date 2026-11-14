/** Structured data for the blog, shared by the React pages and the server prerender (via the build generator). */
import { POSTS, readMinutes, type Post } from "./posts";

export const BLOG_TITLE = "The Proteus AI blog";
export const BLOG_LEDE = "Notes from building Proteus AI, the deal desk for internet businesses: how it works, what broke along the way, and what is not done yet. Every claim matches our docs or the chain.";

const PUBLISHER = (origin: string) => ({ "@type": "Organization", name: "Proteus AI", url: origin, logo: { "@type": "ImageObject", url: `${origin}/og/docs.jpg` } });

export const ogImage = (origin: string, p: Post) => `${origin}/blog/og/${p.slug}.jpg`;

export function postLd(origin: string, p: Post) {
  const url = `${origin}/blog/${p.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      url,
      mainEntityOfPage: url,
      image: [ogImage(origin, p), origin + p.hero.src],
      datePublished: p.date,
      dateModified: p.updated ?? p.date,
      author: { "@type": "Person", name: "Aditya", jobTitle: "Founder", worksFor: { "@type": "Organization", name: "Proteus AI", url: origin } },
      publisher: PUBLISHER(origin),
      keywords: p.tags.join(", "),
      timeRequired: `PT${readMinutes(p)}M`,
      inLanguage: "en",
      isPartOf: { "@type": "Blog", name: BLOG_TITLE, url: `${origin}/blog` },
      encoding: { "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: `${url}.md` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Proteus AI", item: origin },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${origin}/blog` },
        { "@type": "ListItem", position: 3, name: p.title, item: url },
      ],
    },
  ];
}

export function indexLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: BLOG_TITLE,
    description: BLOG_LEDE,
    url: `${origin}/blog`,
    publisher: PUBLISHER(origin),
    blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${origin}/blog/${p.slug}`, datePublished: p.date, description: p.description })),
  };
}

export const formatDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
