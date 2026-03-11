import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { DocPage } from './components/DocPage'
import { docs } from './docs'

function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/:slug" element={<DocPage />} />
            <Route
              path="*"
              element={<Navigate to={`/${docs[0].slug}`} replace />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
