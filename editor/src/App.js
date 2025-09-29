import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import EditorPage from './pages/EditorPage';


import './index';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/lobby/:id' element={<LobbyPage />} />
        <Route path='/editor/:id' element={<EditorPage />} />
        {/* Redirect any unmatched paths to the home page */}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;