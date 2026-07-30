import { Link, Route, Routes } from "react-router-dom";
import { MapPage } from "./pages/MapPage";
import { HikeDetailPage } from "./pages/HikeDetailPage";
import { AddHikePage } from "./pages/AddHikePage";

export function App() {
  return (
    <div className="app">
      <header>
        <h1>
          <Link to="/">🥾 Randonnées</Link>
        </h1>
        <nav>
          <Link to="/">Carte</Link> · <Link to="/add">Ajouter une randonnée</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/hikes/:id" element={<HikeDetailPage />} />
          <Route path="/add" element={<AddHikePage />} />
        </Routes>
      </main>
    </div>
  );
}
