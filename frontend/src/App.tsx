import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "./components/pages/HomePage";
import { VideoPage } from "./components/pages/VideoPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/video/:videoName" element={<VideoPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
