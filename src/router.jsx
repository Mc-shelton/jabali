import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import About from './pages/About';
import Music from './pages/Music';
import Choir from './pages/Choir';
import Contact from './pages/Contact';
import Join from './pages/Join';
import Partnerships from './pages/Partnerships';
import Community from './pages/Community';
import Gallery from './pages/Gallery';
import NotFound from './pages/NotFound';

// Centralized route map using React Router's data APIs.
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'music', element: <Music /> },
      { path: 'join', element: <Join /> },
      { path: 'partnerships', element: <Partnerships /> },
      { path: 'community', element: <Community /> },
      { path: 'gallery', element: <Gallery /> },
      { path: 'chorale', element: <Choir /> },
      { path: 'contact', element: <Contact /> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);

export default router;
