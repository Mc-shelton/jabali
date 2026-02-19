import { Link } from 'react-router-dom';

const NotFound = () => (
  <section>
    <h2>Page Not Found</h2>
    <p>The page you were looking for is missing. Try starting from the homepage.</p>
    <Link className="nav-link" to="/">Back to Home</Link>
  </section>
);

export default NotFound;
