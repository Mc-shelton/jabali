import { useEffect, useState } from 'react';
import {
  fetchContent,
  fetchEvent,
  fetchEvents,
  fetchJabali5,
  fetchMerch,
  fetchMerchProduct,
} from '../lib/api';
import { getEventBySlug, upcomingEvents, pastEvents } from '../data/events';
import { jabaliFive } from '../data/jabali5';
import { contentSeed } from '../data/content';

// Each hook seeds state from the bundled static data so first paint always has
// content, then swaps in the live API response when it arrives. If the API is
// unreachable the seed simply stays — the page never breaks.

export function useEvents() {
  const [data, setData] = useState({ upcoming: upcomingEvents, past: pastEvents });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchEvents()
      .then((live) => {
        if (active && live) setData(live);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...data, loading };
}

export function useEvent(slug) {
  const seed = getEventBySlug(slug) ?? null;
  const [event, setEvent] = useState(seed);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setEvent(getEventBySlug(slug) ?? null);
    setLoading(true);

    fetchEvent(slug)
      .then((live) => {
        if (active) setEvent(live);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return { event, loading };
}

// A dashboard-managed content section, e.g. useContent('contact').
// Seeds from the bundled default so first paint is never blank, then swaps in
// the saved content. A falsy response leaves the seed in place.
export function useContent(section) {
  const [data, setData] = useState(() => contentSeed(section));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setData(contentSeed(section));
    setLoading(true);

    fetchContent(section)
      .then((live) => {
        if (active && live) setData(live);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [section]);

  return { data, loading };
}

// Music, plus the id-list lookup the pages need. Curated strips (home promo,
// recent records) are stored as ordered track IDs, so resolving them against the
// catalogue happens here rather than in three separate components.
export function useMusic() {
  const { data, loading } = useContent('music');

  const byIds = (ids) =>
    (ids ?? []).map((id) => data.catalog.find((track) => track.id === id)).filter(Boolean);

  return { ...data, byIds, loading };
}

// The merchandise catalogue.
//
// No bundled seed, unlike events and the content sections: there is no honest
// default set of products to show, and inventing one would put things on sale
// that the chorale doesn't stock. An unreachable API means an empty shop, and
// the page says so.
export function useMerch() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMerch()
      .then((data) => {
        if (active) setProducts(data?.products ?? []);
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { products, loading };
}

// One product, for its own page. `null` once loading is done means "no such
// product", which the page turns into a not-found rather than a blank screen.
export function useMerchProduct(id) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProduct(null);

    fetchMerchProduct(id)
      .then((data) => {
        if (active) setProduct(data ?? null);
      })
      .catch(() => {
        if (active) setProduct(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return { product, loading };
}

export function useJabali5() {
  const [data, setData] = useState(jabaliFive);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchJabali5()
      .then((live) => {
        if (active && live) setData(live);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...data, loading };
}
