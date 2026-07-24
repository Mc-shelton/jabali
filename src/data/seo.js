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
export const routeSeo = {
  '/': ['Jabali Chorale — Gospel in Song', 'Nairobi gospel choir sharing Christ through rich choral music, worship and community ministry. Listen, attend an event, book us or join Jabali Chorale.'],
  '/about': ['About Our Nairobi Gospel Choir', 'Meet Jabali Chorale, a Christ-centred gospel choir founded in Nairobi in 2022, and discover our calling, story and chorale members.'],
  '/music': ['Gospel & Choral Music', 'Listen to Jabali Chorale’s gospel songs, featured releases and Christ-centred choral music from Nairobi, Kenya.'],
  '/events': ['Gospel Choir Events in Nairobi', 'Discover upcoming Jabali Chorale concerts, cantatas, worship services and community ministry events in Nairobi, Kenya.'],
  '/merch': ['Jabali Chorale Merchandise', 'Shop official Jabali Chorale merchandise and support our gospel music and ministry in Nairobi.'],
  '/jabali-at-5': ['Jabali at 5', 'Celebrate five years of Jabali Chorale through the music, ministry, milestones and stories that shaped our Nairobi gospel choir.'],
  '/join': ['Join Jabali Chorale', 'Join Jabali Chorale in Nairobi as a singer, musician or ministry volunteer. Learn about rehearsals and how to apply.'],
  '/partnerships': ['Partner With Jabali Chorale', 'Partner with Jabali Chorale for gospel concerts, church ministry, outreach, events and creative collaborations in Kenya.'],
  '/community': ['Jabali Chorale Community', 'Explore the people, fellowship and community outreach surrounding Jabali Chorale’s gospel music ministry in Nairobi.'],
  '/gallery': ['Photo Gallery', 'See Jabali Chorale in worship, rehearsal, concert and community ministry through our latest photo collections.'],
  '/contact': ['Contact & Book Jabali Chorale', 'Book Jabali Chorale for a church service, concert or special event in Kenya, or contact us about joining and partnerships.'],
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
  description: 'A Christ-centred gospel chorale based in Nairobi, Kenya.',
  foundingDate: '2022-08-18',
  email: 'outreach@jabalichorale.com',
  telephone: '+254743349733',
  address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
  sameAs: ['https://www.youtube.com/@jabalichorale'],
};
