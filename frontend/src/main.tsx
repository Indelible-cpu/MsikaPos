import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './context/ThemeProvider'

import { registerSW } from 'virtual:pwa-register'
import toast from 'react-hot-toast'

const updateSW = registerSW({
  onNeedRefresh() {
    toast((t) => (
      <div className="flex flex-col gap-2 p-1">
        <p className="text-sm font-black text-zinc-800 uppercase tracking-tight">Updates available. Update?</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              updateSW(true);
              toast.dismiss(t.id);
            }}
            className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            Update Now
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="bg-zinc-100 text-zinc-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase"
          >
            Later
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      position: 'bottom-center',
      style: {
        borderRadius: '24px',
        background: '#fff',
        color: '#000',
        padding: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(0,0,0,0.05)'
      }
    });
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

const queryClient = new QueryClient()

// Initialize font size
const savedFontSize = localStorage.getItem('fontSize') || 'medium';
document.documentElement.setAttribute('data-font-size', savedFontSize);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

