// Single source of truth for per-route SEO metadata.
//
// Imported both by the running app (src/App.jsx, which sets these tags on the
// client after navigation) and by the build-time prerenderer
// (scripts/prerender.mjs, which bakes them into the raw HTML so crawlers and
// the first byte see them without running JavaScript). Keeping one copy means
// the two can never disagree.
//
// Only the fixed marketing routes live here. Event and product detail pages
// change through the admin at runtime, so their metadata is produced live by
// public/preview.php — never frozen at build time.

export const SITE_URL = 'https://jabalichorale.com';
export const DEFAULT_IMAGE = `${SITE_URL}/images/jc_splash.jpeg`;

// [path]: [title, description]
//
// The recurring anchors — "Jabali Chorale", "Nairobi", "gospel choir", the
// Seventh-day Adventist (SDA) tradition, "young / youth", and the University of
// Nairobi campus where it was founded — are woven in naturally rather than
// stacked, because Google ranks on the terms that genuinely match the page.
// Keep these honest: the copy must stay true to what the pages actually say.
export const routeSeo = {
  '/': ['Jabali Chorale — Nairobi SDA Gospel Choir', 'Jabali Chorale is a young, Christ-centred gospel choir in Nairobi, rooted in the Seventh-day Adventist (SDA) tradition and founded at the University of Nairobi campus. Listen to our music, attend an event, book us or join.'],
  '/about': ['About Jabali Chorale | Nairobi Youth Gospel Choir', 'Meet Jabali Chorale — a young, Christ-centred gospel choir founded at the University of Nairobi campus in 2022 and rooted in the Seventh-day Adventist (SDA) tradition. Discover our calling, story and members.'],
  '/music': ['Gospel & Choral Music | Jabali Chorale, Nairobi', 'Listen to Jabali Chorale’s gospel songs and Christ-centred choral music — a young Nairobi choir in the Seventh-day Adventist (SDA) tradition.'],
  '/events': ['Events | Jabali Chorale, Nairobi Gospel Choir', 'Upcoming Jabali Chorale concerts, cantatas, camp meetings and worship events in Nairobi — a young gospel choir in the Seventh-day Adventist (SDA) tradition.'],
  '/merch': ['Shop | Jabali Chorale Merchandise, Nairobi', 'Shop official Jabali Chorale merchandise and support a young Nairobi gospel choir rooted in the Seventh-day Adventist (SDA) tradition.'],
  '/jabali-at-5': ['Jabali at 5 | Jabali Chorale, Nairobi', 'Celebrate five years of Jabali Chorale — the music, ministry and milestones of a young Nairobi gospel choir founded at the University of Nairobi campus.'],
  '/join': ['Join Jabali Chorale | Nairobi Youth Gospel Choir', 'Join Jabali Chorale, a young Nairobi gospel choir founded at the University of Nairobi and rooted in the Seventh-day Adventist (SDA) tradition. Sing, play or serve — see rehearsals and how to apply.'],
  '/partnerships': ['Partner With Jabali Chorale | Nairobi', 'Partner with Jabali Chorale — a young Nairobi gospel choir in the Seventh-day Adventist (SDA) tradition — for concerts, church ministry, outreach and creative collaborations in Kenya.'],
  '/community': ['Community | Jabali Chorale, Nairobi', 'The people, fellowship and outreach around Jabali Chorale — a young Nairobi gospel choir with roots at the University of Nairobi campus and in the Seventh-day Adventist (SDA) tradition.'],
  '/gallery': ['Photo Gallery | Jabali Chorale, Nairobi', 'See Jabali Chorale in worship, rehearsal and concert — a young Nairobi gospel choir in the Seventh-day Adventist (SDA) tradition — through our latest photos.'],
  '/contact': ['Contact & Book Jabali Chorale | Nairobi SDA Choir', 'Book Jabali Chorale — a young Nairobi gospel choir in the Seventh-day Adventist (SDA) tradition — for a church service, concert or event, or reach us about joining and partnerships.'],
};

// Priorities for the fixed routes in the sitemap. Anything not listed defaults
// to 0.7. Event and product URLs are added live by public/sitemap.php.
export const routePriority = {
  '/': 1.0,
  '/music': 0.9,
  '/events': 0.9,
  '/about': 0.8,
  '/join': 0.8,
  '/contact': 0.8,
};

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'MusicGroup',
  '@id': 'https://jabalichorale.com/#organization',
  name: 'Jabali Chorale',
  url: 'https://jabalichorale.com/',
  logo: 'https://jabalichorale.com/graphics/jc_logo_nopg.png',
  image: 'https://jabalichorale.com/images/jc_splash.jpeg',
  description: 'A young, Christ-centred gospel choir in Nairobi, rooted in the Seventh-day Adventist (SDA) tradition and founded at the University of Nairobi campus in 2022.',
  genre: ['Gospel', 'Choral', 'Christian'],
  foundingDate: '2022-08-18',
  foundingLocation: {
    '@type': 'Place',
    name: 'University of Nairobi',
    address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
  },
  email: 'outreach@jabalichorale.com',
  telephone: '+254743349733',
  address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
  sameAs: ['https://www.youtube.com/@jabalichorale'],
};
