import { mediaUrls } from './media';

export const partnershipsPageData = {
  // Was `desertSunrise` — a stock photo of an American desert. The chorale's own
  // photography is both on-brand and stronger.
  backgroundImage: mediaUrls.heroImg2,
  eyebrow: 'Partnerships',
  title: 'Build mission-shaped collaborations with Jabali Chorale.',
  lead:
    'We partner with churches, schools, ministries, and aligned organizations to expand the reach of worship, music education, and community ministry.',
  highlight: {
    label: 'Best fit',
    title: 'Mission-aligned work',
    text: 'Projects that strengthen faith, music, community, or youth development.',
  },
  stats: [
    { value: '3', label: 'Core lanes' },
    { value: '1', label: 'Clear process' },
    { value: '100%', label: 'Values-led' },
  ],
  partnerTypes: [
    {
      title: 'Church Partnerships',
      copy: 'Sabbath ministries, camp meetings, revival weeks, and special music ministry collaborations.',
      tag: 'Ministry',
    },
    {
      title: 'School Outreach',
      copy: 'Mentorship sessions, chorale clinics, and values-centered music workshops for students and music departments.',
      tag: 'Formation',
    },
    {
      title: 'Brand & Event Support',
      copy: 'Selective partnerships for values-aligned events, recordings, travel support, and mission-driven campaigns.',
      tag: 'Support',
    },
  ],
  strengths: [
    'A polished ensemble with disciplined rehearsal culture',
    'Event readiness for live worship, staged programs, and collaborative productions',
    'A gospel-rooted identity that keeps partnerships coherent and credible',
  ],
  process: [
    'Share the event, ministry, or campaign objective.',
    'Align on format, venue, dates, and practical support needs.',
    'Confirm scope and move into planning with the chorale team.',
  ],
  inquiry: {
    label: 'Start A Conversation',
    title: 'Let’s discuss scope, venue, and goals.',
    text: 'Send us the objective, the format you have in mind, and your timelines — we’ll come back with how the chorale can fit.',
    ctaLabel: 'Start A Partnership Enquiry',
    ctaTo: '/contact?topic=partnership',
  },
};
