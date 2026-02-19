import { NavLink, Outlet } from 'react-router-dom';
import Footer from './components/footer';
import Home from './pages/Home';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/choir', label: 'Choir' },
  { to: '/contact', label: 'Contact' }
];

const App = () => (
  <div className="app-shell">
    <Home/>
    <Footer/>
  </div>
);

export default App;
