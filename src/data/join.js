import { contactItems } from './contact';
import { mediaUrls } from './media';

export const joinPageData = {
  eyebrow: 'Join Jabali',
  title: 'Step into the chorale and serve with us.',
  lead:
    'We welcome committed singers and support team members who want to grow in music, discipline, fellowship, and gospel ministry.',
  backgroundImage: mediaUrls.heroImg1,
  rehearsal: contactItems.find((item) => item.label === 'Rehearsals')?.value ?? 'Every Sunday, 3:00 PM to 5:30 PM, Commerce House CBD',
  rehearsalNote: 'Come prepared, on time, and ready to learn your part.',
  pathways: [
    {
      title: 'Singer Path',
      copy: 'For voices ready to rehearse weekly, learn parts, and minister in performance with the full chorale.',
    },
    {
      title: 'Instrument Support',
      copy: 'For accompanists and rhythm players who help carry the chorale sound in live ministry settings.',
    },
    {
      title: 'Service Team',
      copy: 'For members who want to support logistics, wardrobe, welfare, media, and event preparation.',
    },
  ],
  steps: [
    'Attend a rehearsal visit and meet the section leaders.',
    'Share your voice part, church background, and availability.',
    'Complete a simple audition or placement session.',
    'Join the rehearsal schedule and ministry communication channels.',
  ],
  values: [
    'Faithful and teachable',
    'Consistent with rehearsals',
    'Ministry-minded over spotlight',
  ],
  voiceOptions: [
    'Soprano',
    'Alto',
    'Mezzo-Soprano',
    'Tenor',
    'Baritone',
    'Bass',
    'Instrument Support',
    'Service Team',
    'Not sure yet',
  ],
};
