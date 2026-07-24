import { useEffect } from 'react';

const SITE_URL = 'https://jabalichorale.com';
const DEFAULT_IMAGE = `${SITE_URL}/images/jc_splash.jpeg`;

const setMeta = (selector, attribute, value) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    const match = selector.match(/meta\[(name|property)="([^"]+)"\]/);
    if (match) element.setAttribute(match[1], match[2]);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
};

/** Keeps metadata correct after client-side navigation in the SPA. */
const Seo = ({
  title,
  description,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  structuredData,
}) => {
  useEffect(() => {
    const pageTitle = title.includes('Jabali Chorale') ? title : `${title} | Jabali Chorale`;
    const canonical = `${SITE_URL}${path === '/' ? '/' : path.replace(/\/$/, '')}`;
    const absoluteImage = image?.startsWith('http') ? image : `${SITE_URL}${image || ''}`;

    document.title = pageTitle;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[name="robots"]', 'content', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMeta('meta[property="og:title"]', 'content', pageTitle);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[property="og:type"]', 'content', type);
    setMeta('meta[property="og:image"]', 'content', absoluteImage);
    setMeta('meta[name="twitter:title"]', 'content', pageTitle);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', absoluteImage);

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    const id = 'page-structured-data';
    document.getElementById(id)?.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [description, image, noindex, path, structuredData, title, type]);

  return null;
};

export default Seo;
