'use client'

export default function JustTcgError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#dc2626', fontSize: '1.5rem' }}>JustTCG Error</h1>
      <pre style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        padding: '1rem',
        borderRadius: '0.5rem',
        overflow: 'auto',
        fontSize: '0.875rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {error.message}
        {'\n\n'}
        {error.stack}
        {error.digest && `\n\nDigest: ${error.digest}`}
      </pre>
      <button
        onClick={() => reset()}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Retry
      </button>
    </div>
  )
}
