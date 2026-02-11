function ErrorScreen({ error, onRetry }) {
  return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h2>Error</h2>
      <p>{error || 'An unexpected error occurred'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary">
          Retry
        </button>
      )}
    </div>
  )
}

export default ErrorScreen
