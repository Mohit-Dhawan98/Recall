import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Timeline from './pages/Timeline';
import Search from './pages/Search';
import Graph from './pages/Graph';
import ReadLater from './pages/ReadLater';
import ArticleDetail from './pages/ArticleDetail';
import Share from './pages/Share';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Timeline />} />
        <Route path="search" element={<Search />} />
        <Route path="graph" element={<Graph />} />
        <Route path="read-later" element={<ReadLater />} />
        <Route path="article/:id" element={<ArticleDetail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/share" element={<Share />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
