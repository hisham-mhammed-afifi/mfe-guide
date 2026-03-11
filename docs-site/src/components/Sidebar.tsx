import { NavLink } from 'react-router-dom'
import { docs } from '../docs'

export function Sidebar() {
  const grouped = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    if (!acc[doc.part]) acc[doc.part] = []
    acc[doc.part].push(doc)
    return acc
  }, {})

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>MFE Guide</h1>
        <p className="sidebar-subtitle">Angular + Nx + Module Federation</p>
      </div>
      <nav className="sidebar-nav">
        {Object.entries(grouped).map(([part, pages]) => (
          <div key={part} className="nav-group">
            <span className="nav-group-label">{part}</span>
            {pages.map((page) => (
              <NavLink
                key={page.slug}
                to={`/${page.slug}`}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                {page.title}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
