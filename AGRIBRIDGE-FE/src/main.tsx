import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
   <ToastProvider>
      <App />
   </ToastProvider>
  </BrowserRouter>,
)
