// Static seeds for the dashboard-managed content sections.
//
// These mirror the API response shape exactly, section for section, so a page
// renders identically whether it's using the live content or this fallback.
// They are the factory default: first paint before the fetch resolves, and the
// permanent answer when the API is unreachable (local dev with no PHP, or the
// backend being down). Once an admin saves a section, the server's copy wins.
//
// Keep these in sync with public/api/_sections.php — same keys, same nesting.
import { choirMembers } from './about';
import { contactItems, contactIntro } from './contact';
import { socialLinks } from './social';
import { joinPageData } from './join';
import { partnershipsPageData } from './partnerships';
import { communityPageData } from './community';
import {
  musicPlatformLinks,
  musicCatalog,
  featuredReleases,
  recentRecordIds,
  homePromoTrackIds,
} from './music';
import {
  galleryBoards,
  galleryCategories,
  galleryFeature,
  galleryMarqueeImages,
} from './gallery';

export const contentSeeds = {
  contact: {
    intro: {
      title: contactIntro.title,
      lead: contactIntro.lead,
      note: contactIntro.note,
    },
    items: contactItems.map(({ label, value }) => ({ label, value })),
  },

  social: {
    links: socialLinks.map(({ id, label, url }) => ({ id, label, url: url ?? null })),
  },

  members: {
    members: choirMembers.map(({ name, voice, photo, church }) => ({
      name,
      voice,
      photo,
      church,
    })),
  },

  // `rehearsal` is derived server-side from the contact section; mirrored here so
  // the fallback has the same shape (see content_enrich_join in _sections.php).
  join: {
    ...joinPageData,
    rehearsal:
      contactItems.find((item) => item.label === 'Rehearsals')?.value ?? '',
  },

  partnerships: partnershipsPageData,

  // topLinks / sideLinks stay in code — they're navigation, not content.
  community: {
    backgroundImage: communityPageData.backgroundImage,
    spotlight: communityPageData.spotlight,
    highlights: communityPageData.highlights,
  },

  // streamingLinks is stamped onto each track server-side; mirrored here.
  music: {
    platformLinks: musicPlatformLinks,
    catalog: musicCatalog.map((track) => ({
      ...track,
      streamingLinks: musicPlatformLinks,
    })),
    featuredReleases,
    recentRecordIds,
    homePromoTrackIds,
  },

  gallery: {
    boards: galleryBoards,
    categories: galleryCategories,
    // `size` is deliberately dropped — the schema has no such field and nothing
    // renders it, so keeping it here would make the seed and the API disagree.
    feature: {
      title: galleryFeature.title,
      category: galleryFeature.category,
      image: galleryFeature.image,
      artist: galleryFeature.artist,
      location: galleryFeature.location,
      note: galleryFeature.note,
    },
    marqueeImages: galleryMarqueeImages,
  },

  // Copy that used to live inline in the JSX. Headings are split into a plain
  // and an emphasised part to match how they're rendered.
  pages: {
    homeHero: {
      eyebrow: 'Est. 2022 · Nairobi',
      title: 'Founded',
      titleEm: 'Music.',
      lead:
        'The melody of song, poured forth from many hearts in clear, distinct utterance, is one of God’s instrumentalities in the work of saving souls.',
      ctaPrimary: 'About Jabali Chorale',
      ctaSecondary: 'Listen to our music',
    },
    aboutBand: {
      eyebrow: 'Christ Founded',
      title: 'About Jabali',
      titleEm: 'Chorale',
      lead:
        'We’re committed to bringing Jesus, the transforming power of the gospel, to the life of every soul for a full reflection of His image without spot or wrinkle.',
      ctaLabel: 'Read our story',
      facts: [
        { label: 'Founded', value: '18 August 2022' },
        { label: 'Based in', value: 'Nairobi, Kenya' },
      ],
    },
    aboutStory: {
      eyebrow: 'Our Calling',
      title: 'The chorale and the calling.',
      paragraphs: [
        'Jabali Chorale exists to carry the gospel in song with warmth, discipline, and conviction. A chorale shaped by worship, close fellowship, and the desire to serve both church and community.',
        'We rehearse consistently, build blend across sections, and approach each performance as ministry first. Every arrangement is meant to be clear in message, rich in harmony, and grounded in the hope of Christ.',
      ],
      pointsEyebrow: 'What Defines Jabali',
      points: [
        'Christ-centered repertoire and testimony-driven performances.',
        'Balanced sections across soprano, alto, tenor, and bass.',
        'Weekly rehearsals focused on blend, diction, timing, and spiritual preparation.',
        'Performance that values reverence, clarity, and strong choral presence.',
      ],
    },
    roster: {
      eyebrow: 'The Chorale',
      title: 'Meet the voices.',
      note: 'members. Choose a face to open their profile.',
    },
    footer: {
      mission:
        'We’re committed to bringing Jesus, the transforming power of the gospel, to the life of every soul for a full reflection of His image without spot or wrinkle.',
    },
  },
};

export const contentSeed = (section) => contentSeeds[section] ?? null;
