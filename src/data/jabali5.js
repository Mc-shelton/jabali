import { formatEventDate, getEventBySlug } from './events';

// The "Jabali @5" anniversary journey — a curated four-chapter story told across
// real events. Each chapter carries its own narrative beat and, by default, pulls
// its poster / date / title / status from the linked event so there's a single
// source of truth. Any field an admin fills in as an override wins over the event.
//
// TODO(jabali): the headings and tales are anniversary framing you can rewrite.
// The chapters just need to point at real event slugs (or supply their own
// poster), in story order.
const chapters = [
  {
    heading: 'Where the song began',
    tale:
      'A handful of voices, one conviction, and a season of giving that took the chorale out into the community for the very first time.',
    eventSlug: 'season-of-giving-2025',
  },
  {
    heading: 'Finding our voice',
    tale:
      'Nightly worship, section by section, until the blend became unmistakable. This was the week Jabali learned to sound like one body.',
    eventSlug: 'revival-week-2026',
  },
  {
    heading: 'The night ahead',
    tale:
      'The chorale steps into its fullest season yet — a praise night to open the second half of the year and carry the story forward.',
    eventSlug: 'sunset-praise-night',
  },
  {
    heading: 'The homecoming',
    tale:
      'Five years, gathered into one programme. A cantata on the Second Coming to close the journey where it always pointed — to Christ.',
    eventSlug: 'songs-of-the-second-coming',
  },
];

// The card that closes the horizontal journey rail. Fully admin-editable.
const endCard = {
  kicker: 'The story continues',
  line: 'Be part of chapter five.',
  ctaLabel: 'Join the chorale',
  ctaHref: '/join',
};

// A non-empty override wins; otherwise inherit the linked event's value.
const pick = (override, fallback) => (override ? override : fallback || '');

// Enrich one stored chapter into the shape the page renders. Chapters that
// neither link a real event nor carry their own poster are dropped (return null).
const enrichChapter = (chapter, index) => {
  const event = chapter.eventSlug ? getEventBySlug(chapter.eventSlug) : null;

  const poster = pick(chapter.poster, event?.poster);
  if (!event && !poster) return null;

  const eventDate = event ? formatEventDate(event.date) : null;
  const dateLabel =
    chapter.dateLabel || (eventDate ? `${eventDate.month} ${eventDate.year}` : '');

  let done;
  if (chapter.status === 'past') done = true;
  else if (chapter.status === 'upcoming') done = false;
  else done = event ? event.status === 'past' : false;

  const href = chapter.href || (event && chapter.eventSlug ? `/events/${chapter.eventSlug}` : '');

  return {
    number: String(index + 1).padStart(2, '0'),
    heading: chapter.heading || '',
    tale: chapter.tale || '',
    eventSlug: chapter.eventSlug || '',
    eventTitle: pick(chapter.eventTitle, event?.title),
    type: pick(chapter.type, event?.type),
    poster,
    dateLabel,
    done,
    href,
  };
};

export const jabaliFive = {
  tag: 'Jabali @5',
  eyebrow: 'The Journey · Est. 2022',
  title: 'Five years. One story.',
  intro:
    'Jabali Chorale turns five. This is the road so far and the road ahead — four chapters, two behind us and two to come, that tell how a few voices became a ministry in song.',
  endCard,
  chapters: chapters.map(enrichChapter).filter(Boolean),
};
