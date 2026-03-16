import { Outlet } from 'react-router-dom';
import Footer from './components/footer';

const App = () => (
  <div className="app-shell">
    <Outlet />
    <Footer />
  </div>
);

export default App;
