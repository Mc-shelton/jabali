import { mediaUrls } from './media';

export const communityPageData = {
  backgroundImage: mediaUrls.desertSunrise,
  topLinks: [
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ],
  sideLinks: [
    { to: '/', label: 'Home', shortLabel: 'Home' },
    { to: '/about', label: 'About', shortLabel: 'About' },
    { to: '/gallery', label: 'Gallery', shortLabel: 'Gallery' },
    { to: '/contact', label: 'Contact', shortLabel: 'Contact' },
  ],
  spotlight: {
    leadLabel: 'JC Community',
    metric: 'Voice.',
    metricValue: '01',
    metricCaption: 'A connected space for chorale members, supporters, and the wider Jabali circle.',
    title: 'A new home for the Jabali community.',
    subtitle: 'Music. Fellowship. Growth.',
    badge: 'NOW BUILDING...',
    supportingText:
      'JC Community will gather updates, shared memories, ministry opportunities, and practical ways to stay connected with Jabali Chorale beyond performances.',
  },
  highlights: [
    'Member stories and chorale hightlights',
    'content streaming and community contributions',
    'Announcements, rehearsals, and contact touchpoints',
    'Community-led initiatives and ministry opportunities',
  ],
};
