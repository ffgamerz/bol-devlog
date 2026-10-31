import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/app.css'
import App from '@/app/App'
import { armChunkReload } from '@/lib/chunkReload'

armChunkReload()

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
