import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Note: StrictMode removed intentionally — it double-mounts in dev,
// creating duplicate Web Workers that cause ghost simulation ticks.
createRoot(document.getElementById('root')!).render(
  <App />,
)
