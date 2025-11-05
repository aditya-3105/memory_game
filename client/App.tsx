import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CardFlipGame from "./pages/CardFlipGame";
import GuessCupGame from "./pages/GuessCupGame";
import SimonSaysGame from "./pages/SimonSaysGame";
import Settings from "./pages/Settings";
import Leaderboard from "./pages/Leaderboard";
import WordBuilderGame from "./pages/WordBuilderGame";
import PicturePuzzleGame from "./pages/PicturePuzzleGame";
import PVP from "./pages/PVP";
import PVPResults from "./pages/PVPResults";
import Profile from "./pages/Profile";
import PVPGameContainer from "./components/PVPGameContainer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/game/card-flip" element={<CardFlipGame />} />
              <Route path="/game/guess-cup" element={<GuessCupGame />} />
              <Route path="/game/simon-says" element={<SimonSaysGame />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/game/word-builder" element={<WordBuilderGame />} />
              <Route
                path="/game/picture-puzzle"
                element={<PicturePuzzleGame />}
              />
              <Route path="/pvp" element={<PVP />} />
              <Route path="/profile" element={<Profile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
