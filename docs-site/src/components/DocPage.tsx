import { useParams, Navigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { docs } from '../docs'
import { useMarkdown } from '../hooks/useMarkdown'

export function DocPage() {
  const { slug } = useParams<{ slug: string }>()
  const page = docs.find((d) => d.slug === slug)

  if (!page) return <Navigate to={`/${docs[0].slug}`} replace />

  const { content, loading, error } = useMarkdown(page.file)

  const currentIndex = docs.indexOf(page)
  const prev = currentIndex > 0 ? docs[currentIndex - 1] : null
  const next = currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null

  return (
    <article className="doc-content">
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      {!loading && !error && (
        <>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeSlug]}
            components={{
              // Open external links in new tab
              a: ({ href, children, ...props }) => {
                const isExternal = href?.startsWith('http')
                return (
                  <a
                    href={href}
                    {...(isExternal
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    {...props}
                  >
                    {children}
                  </a>
                )
              },
              // Style blockquotes as callouts
              blockquote: ({ children }) => {
                const text = String(children)
                let type = 'note'
                if (text.includes('**Warning:**')) type = 'warning'
                else if (text.includes('**Tip:**')) type = 'tip'
                return (
                  <blockquote className={`callout callout-${type}`}>
                    {children}
                  </blockquote>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
          <nav className="page-nav">
            {prev && (
              <a href={`/${prev.slug}`} className="page-nav-link prev">
                <span className="page-nav-label">Previous</span>
                <span className="page-nav-title">{prev.title}</span>
              </a>
            )}
            {next && (
              <a href={`/${next.slug}`} className="page-nav-link next">
                <span className="page-nav-label">Next</span>
                <span className="page-nav-title">{next.title}</span>
              </a>
            )}
          </nav>
        </>
      )}
    </article>
  )
}
