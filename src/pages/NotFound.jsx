import { Link } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import '../styles/not-found.scss';

const NotFound = () => (
  <main className="not-found section">
    <div className="not-found-inner shell">
      <p className="eyebrow">Error 404</p>
      <h1 className="display-lg not-found-title">
        This page has
        <em>fallen silent.</em>
      </h1>
      <p className="lead">The page you were looking for isn’t here. Let’s get you back to the music.</p>
      <Link className="btn btn-primary" to="/">
        Back to home
        <ArrowRightOutlined />
      </Link>
    </div>
  </main>
);

export default NotFound;
