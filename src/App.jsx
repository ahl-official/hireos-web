import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TestPage from './pages/TestPage';
import AlisaUiLab from './pages/AlisaUiLab';

import ReportPage from './pages/ReportPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/test/:id" element={<TestPage />} />
        <Route path="/report/:id" element={<ReportPage />} />
        <Route path="/alisa-ui-lab" element={<AlisaUiLab />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
