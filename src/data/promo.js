// Factory default for the event pop-up.
//
// Off. A pop-up is the most intrusive thing the site can do to a visitor, so
// the fallback — used before the API answers, and permanently if the backend is
// unreachable — must be the state that shows nothing. An admin switching it on
// is the only thing that should ever make it appear.
export const promoDefaults = {
  enabled: false,
  eventSlug: '',
  headline: '',
  blurb: '',
  ctaLabel: '',
  image: '',
};
