import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import GuestPage from './pages/GuestPage';
import { WobDefs } from './diary/Doodles';
import { AlbumPage, HostEventPage, HostNewPage } from './pages/HostPages';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WobDefs />
    <BrowserRouter>
      <Routes>
        <Route path="/e/:eventId" element={<GuestPage />} />
        <Route path="/e/:eventId/album" element={<AlbumPage />} />
        <Route path="/host/new" element={<HostNewPage />} />
        <Route path="/host/:eventId" element={<HostEventPage />} />
        <Route path="*" element={<div className="plain"><h1>Event Camera</h1><p>QRコードからアクセスしてください。</p></div>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
