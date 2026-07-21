import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
    </div>
  );
};

export default App;
