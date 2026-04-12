import { Outlet, useLocation } from 'react-router-dom';
import Footer from './components/footer';
import SiteNav from './components/SiteNav';

const App = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="app-shell">
      {!isHome && <SiteNav variant="page" />}
      <Outlet />
      <Footer />
    </div>
  );
};

export default App;
