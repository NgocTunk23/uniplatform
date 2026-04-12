import React from 'react';
import ReactDOM from 'react-dom/client';
// Import file App.tsx nằm trong thư mục app (do Figma tạo)
import App from './app/App'; 
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)