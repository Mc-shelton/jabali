const PageLoader = ({ label = 'Loading content…', compact = false }) => (
  <div
    className={`page-loader${compact ? ' is-compact' : ''}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span className="page-loader-spinner" aria-hidden="true" />
    <span className="page-loader-label">{label}</span>
  </div>
);

export default PageLoader;
