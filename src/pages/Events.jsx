import { Link } from 'react-router-dom';
import { ArrowRightOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import '../styles/events-page.scss';
import { formatEventDate } from '../data/events';
import { useEvents } from '../hooks/usePublicData';
import PageLoader from '../components/PageLoader';

const Events = () => {
  const { upcoming: upcomingEvents, past: pastEvents, loading } = useEvents();

  if (loading) {
    return (
      <main className="ev-page">
        <PageLoader label="Loading events…" />
      </main>
    );
  }

  return (
  <main className="ev-page">
    <header className="page-header shell">
      <p className="eyebrow">Events</p>
      <h1 className="display-lg ev-title">Where to find the chorale next.</h1>
      <p className="lead">
        Concerts, camp meetings, and ministry appearances — the times and places to worship with Jabali
        Chorale in person.
      </p>
    </header>

    <section className="section shell">
      <div className="section-head reveal">
        <p className="eyebrow">Upcoming</p>
        <h2 className="display-md">What&rsquo;s next.</h2>
      </div>

      {upcomingEvents.length > 0 ? (
        <ol className="ev-list reveal">
          {upcomingEvents.map((item) => {
            const d = formatEventDate(item.date);

            return (
              <li key={item.slug}>
                <Link className="ev-card" to={`/events/${item.slug}`}>
                  <span className="ev-date" aria-hidden="true">
                    <span className="ev-date-weekday">{d.weekday}</span>
                    <span className="ev-date-day">{d.day}</span>
                    <span className="ev-date-month">{d.month}</span>
                  </span>

                  <span className="ev-body">
                    <span className="ev-type">{item.type}</span>
                    <span className="ev-name">{item.title}</span>

                    <span className="ev-meta">
                      <span>
                        <EnvironmentOutlined /> {item.venue}
                      </span>
                      {item.time && (
                        <span>
                          <ClockCircleOutlined /> {item.time}
                        </span>
                      )}
                      {item.ticketed && <span className="ev-badge">Ticketed</span>}
                    </span>

                    <span className="ev-desc">{item.summary}</span>
                  </span>

                  <span className="ev-go" aria-hidden="true">
                    <ArrowRightOutlined />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="ev-empty reveal">
          <p>No public dates are on the calendar right now.</p>
          <Link className="btn btn-primary" to="/contact">
            Invite the chorale
            <ArrowRightOutlined />
          </Link>
        </div>
      )}
    </section>

    {pastEvents.length > 0 && (
      <section className="section shell ev-past-section">
        <div className="section-head reveal">
          <p className="eyebrow">Archive</p>
          <h2 className="display-md">Where we&rsquo;ve been.</h2>
        </div>

        <ul className="ev-past reveal">
          {pastEvents.map((item) => {
            const d = formatEventDate(item.date);

            return (
              <li key={item.slug}>
                <Link className="ev-past-row" to={`/events/${item.slug}`}>
                  <span className="ev-past-date">
                    {d.month} {d.year}
                  </span>
                  <span className="ev-past-title">{item.title}</span>
                  <span className="ev-past-type">{item.type}</span>
                  <span className="ev-past-venue">{item.venue}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    )}

    <section className="shell">
      <div className="ev-invite reveal">
        <div>
          <p className="eyebrow">Booking</p>
          <h2 className="display-md">Want the chorale at your event?</h2>
          <p className="ev-invite-copy">
            We minister at church programmes, camp meetings, and community events. Reach out and we&rsquo;ll
            shape the right format.
          </p>
        </div>

        <Link className="btn btn-primary" to="/contact">
          Book the chorale
          <ArrowRightOutlined />
        </Link>
      </div>
    </section>
    </main>
  );
};

export default Events;
