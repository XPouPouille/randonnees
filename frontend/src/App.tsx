import { Link, Route, Routes } from "react-router-dom";
import { MapPage } from "./pages/MapPage";
import { ListPage } from "./pages/ListPage";
import { HikeDetailPage } from "./pages/HikeDetailPage";
import { AddHikePage } from "./pages/AddHikePage";
import { CreatePage } from "./pages/CreatePage";
import { useTheme } from "./theme";

export function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app">
      <header>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === "light" ? "Passer en thème sombre" : "Passer en thème clair"}
          aria-label={theme === "light" ? "Passer en thème sombre" : "Passer en thème clair"}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <div className="title-nav">
          <h1>
            <Link to="/">🥾 Randonnées</Link>
          </h1>
          <nav>
            <Link to="/">Carte</Link> · <Link to="/liste">Liste</Link> ·{" "}
            <Link to="/add">Ajouter une randonnée</Link> · <Link to="/creer">Créer un tracé</Link>
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/liste" element={<ListPage />} />
          <Route path="/hikes/:id" element={<HikeDetailPage />} />
          <Route path="/add" element={<AddHikePage />} />
          <Route path="/creer" element={<CreatePage />} />
        </Routes>
      </main>
    </div>
  );
}
