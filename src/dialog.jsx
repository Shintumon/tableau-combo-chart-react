import { install } from './utils/logger'
// Install console capture before anything else
install()

import React from 'react'
import ReactDOM from 'react-dom/client'
import DialogApp from './DialogApp'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DialogApp />
  </React.StrictMode>
)
