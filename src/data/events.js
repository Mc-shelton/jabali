import { assetPath } from '../utils/assetPath';

// Events content.
//
// TODO(jabali): these entries are illustrative scaffolding — replace them with
// real events, posters, and (where ticketed) real ticket URLs.
//   • To move an event from Upcoming to Past, cut it from `upcomingEvents` and
//     paste it into `pastEvents`.
//   • `packages` are the ticket tiers. Each has a name, price, an optional note,
//     and an optional `url` (its own checkout/RSVP page). Leave `url` null and
//     that tier falls back to an email reservation rather than a dead button.
//     An event with no packages is treated as free entry.
//   • `poster` is the event's key image. `media` is an optional photo set shown
//     on the detail page (mostly useful for past events).

const img = (name) => assetPath(`/images/${name}`);

const event = ({
  slug,
  status = 'upcoming', // 'upcoming' | 'past' — matches the API shape
  date, // 'YYYY-MM-DD'
  time = null, // 'h:mm AM/PM'
  type,
  title,
  venue,
  summary,
  about = [],
  poster,
  packages = [], // [{ name, price, note?, url? }]
  merch = [], // [{ name, price, description?, image? }]
  media = [],
}) => ({
  slug,
  status,
  date,
  time,
  type,
  title,
  venue,
  summary,
  about,
  poster,
  ticketed: packages.length > 0,
  packages,
  merch,
  media,
});

export const upcomingEvents = [
  event({
    slug: 'sunset-praise-night',
    date: '2026-08-15',
    time: '6:00 PM',
    type: 'Concert',
    title: 'Sunset Praise Night',
    venue: 'Commerce House, Nairobi CBD',
    summary:
      'An evening of choral worship and testimony as the chorale opens its second-half season.',
    about: [
      'Sunset Praise Night gathers the full chorale for an evening built around worship, testimony, and new arrangements from the current project.',
      'Doors open at 5:30 PM. Come early for seating; the programme runs about two hours with a short interval.',
    ],
    poster: img('jc_1.jpeg'),
    packages: [
      { name: 'Regular', price: 'KES 500', note: 'General seating' },
      { name: 'Couple', price: 'KES 900', note: 'Two seats together' },
      { name: 'Group of 5', price: 'KES 2,000', note: 'Best value for a team' },
    ],
    merch: [
      { name: 'Jabali @5 T-Shirt', price: 'KES 1,200', description: 'Anniversary tee in chorale navy.', image: img('jc_2.jpeg') },
      { name: 'Live Album (CD)', price: 'KES 800', description: 'A recording of the chorale’s recent set.', image: img('IMG-20260302-WA0014.jpg') },
    ],
    media: [img('20260111_172207.jpg'), img('20260111_161459.jpg'), img('IMG-20260302-WA0011.jpg')],
  }),
  event({
    slug: 'regional-camp-meeting',
    date: '2026-09-05',
    time: '9:00 AM',
    type: 'Camp Meeting',
    title: 'Regional Camp Meeting Ministry',
    venue: 'To be confirmed',
    summary: 'Jabali joins the regional camp meeting for a weekend of music ministry and outreach.',
    about: [
      'The chorale ministers across the weekend camp meeting programme, supporting worship sessions and joining the outreach effort.',
      'Entry is free and open to all. Venue details will be confirmed closer to the date.',
    ],
    poster: img('jc_2.jpeg'),
    // No packages → free entry.
  }),
  event({
    slug: 'songs-of-the-second-coming',
    date: '2026-10-24',
    time: '4:00 PM',
    type: 'Cantata',
    title: 'Songs of the Second Coming',
    venue: 'To be confirmed',
    summary:
      'A themed cantata built around the Three Angels’ Message — new arrangements and readings.',
    about: [
      'A full cantata programme themed on the Three Angels’ Message of Revelation 14, weaving choral arrangements with spoken readings.',
      'Seating is limited for this one — tickets are recommended in advance.',
    ],
    poster: img('20260111_172052.jpg'),
    packages: [
      { name: 'Regular', price: 'KES 300', note: 'General seating' },
      { name: 'Front Row', price: 'KES 600', note: 'Reserved seating up front' },
    ],
  }),
];

export const pastEvents = [
  event({
    slug: 'revival-week-2026',
    status: 'past',
    date: '2026-04-12',
    type: 'Revival Week',
    title: 'Revival Week Music Ministry',
    venue: 'Nairobi',
    summary: 'A week of nightly worship and preaching supported by the chorale.',
    about: ['The chorale supported a full week of nightly revival meetings with music ministry and special items.'],
    poster: img('IMG-20260227-WA0010.jpg'),
    media: [img('20260111_172001.jpg'), img('20260131_101159.jpg'), img('20260208_165048.jpg')],
  }),
  event({
    slug: 'easter-cantata-2026',
    status: 'past',
    date: '2026-03-28',
    type: 'Concert',
    title: 'Easter Cantata',
    venue: 'Nairobi',
    summary: 'A resurrection-themed programme of spirituals and hymn arrangements.',
    poster: img('IMG-20260302-WA0014.jpg'),
  }),
  event({
    slug: 'season-of-giving-2025',
    status: 'past',
    date: '2025-12-20',
    type: 'Outreach',
    title: 'Season of Giving Outreach',
    venue: 'Nairobi',
    summary: 'Carols and a charity drive taken into the community over the December season.',
    poster: img('20260111_172207.jpg'),
  }),
];

const allEvents = [...upcomingEvents, ...pastEvents];

export const getEventBySlug = (slug) => allEvents.find((item) => item.slug === slug) ?? null;

export const isPastEvent = (slug) => getEventBySlug(slug)?.status === 'past';

// 'YYYY-MM-DD' → parts, parsed as a plain local date so there's no timezone drift.
export const formatEventDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: String(day).padStart(2, '0'),
    month: date.toLocaleDateString('en-GB', { month: 'short' }),
    year: String(year),
    long: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
};

// Google Calendar "add event" link. Floating local time (no trailing Z) so the
// time shown is exactly what's on the page, wherever the user is.
export const buildCalendarUrl = (item) => {
  const [year, month, day] = item.date.split('-').map(Number);

  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(
      d.getMinutes()
    )}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    details: item.summary ?? '',
    location: item.venue ?? '',
  });

  const time = item.time ? /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(item.time.trim()) : null;

  if (time) {
    let hours = Number(time[1]) % 12;
    if (/pm/i.test(time[3])) hours += 12;
    const start = new Date(year, month - 1, day, hours, Number(time[2]));
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    params.set('dates', `${stamp(start)}/${stamp(end)}`);
  } else {
    // All-day: end date is exclusive, so use the following day.
    const next = new Date(year, month - 1, day + 1);
    const dayStamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    params.set('dates', `${year}${pad(month)}${pad(day)}/${dayStamp(next)}`);
  }

  return `https://www.google.com/calendar/render?${params.toString()}`;
};
