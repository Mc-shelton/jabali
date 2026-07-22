import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import AdminApp from './admin/AdminApp';
import AdminEvents from './admin/AdminEvents';
import AdminEventForm from './admin/AdminEventForm';
import AdminJabali5 from './admin/AdminJabali5';
import AdminOrders from './admin/AdminOrders';
import AdminContent from './admin/AdminContent';
import AdminLogs from './admin/AdminLogs';
import AdminScan from './admin/AdminScan';
import Home from './pages/Home';
import About from './pages/About';
import Music from './pages/Music';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Jabali5 from './pages/Jabali5';
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
      { path: 'events', element: <Events /> },
      { path: 'events/:slug', element: <EventDetail /> },
      { path: 'jabali-at-5', element: <Jabali5 /> },
      { path: 'join', element: <Join /> },
      { path: 'partnerships', element: <Partnerships /> },
      { path: 'community', element: <Community /> },
      { path: 'gallery', element: <Gallery /> },
      { path: 'contact', element: <Contact /> },
      { path: '*', element: <NotFound /> }
    ]
  },
  // Admin lives outside the public App layout — no public nav or footer.
  {
    path: '/admin',
    element: <AdminApp />,
    children: [
      { index: true, element: <Navigate to="events" replace /> },
      { path: 'events', element: <AdminEvents /> },
      { path: 'events/new', element: <AdminEventForm /> },
      { path: 'events/:slug/edit', element: <AdminEventForm /> },
      { path: 'orders', element: <AdminOrders /> },
      { path: 'scan', element: <AdminScan /> },
      { path: 'jabali5', element: <AdminJabali5 /> },
      // Section is resolved from the schema at runtime, so new sections need no
      // route of their own.
      { path: 'content', element: <AdminContent /> },
      { path: 'content/:section', element: <AdminContent /> },
      { path: 'logs', element: <AdminLogs /> }
    ]
  }
]);

export default router;
