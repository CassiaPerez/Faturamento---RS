import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Fatal Error: Could not find root element 'root'");
  document.body.innerHTML = '<div style="color:red; padding: 20px;">Fatal Error: Root element not found. Please refresh.</div>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (e) {
    console.error("React Mount Error:", e);
    rootElement.innerHTML = `<div style="color:red; padding: 20px;">Application Error: ${e}</div>`;
  }
}