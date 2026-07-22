import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import EventPromo from './components/EventPromo';
import Footer from './components/footer';
import SiteNav from './components/SiteNav';
import useReveal from './hooks/useReveal';

const App = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  useReveal(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={`app-shell ${isHome ? 'is-home' : 'is-page'}`}>
      <SiteNav variant={isHome ? 'home' : 'page'} />
      <Outlet />
      <Footer />
      {/* Mounted on the layout, not on a page: it belongs to the visit rather
          than to any one route, and this is the element that survives every
          in-app navigation. Admin has its own layout, so it never appears
          there. */}
      <EventPromo />
    </div>
  );
};

export default App;
