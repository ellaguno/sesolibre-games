import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import HubScreen from './hub/HubScreen';
import GameHost from './hub/GameHost';
import SettingsScreen from './hub/SettingsScreen';
import RecordsScreen from './hub/RecordsScreen';
import RewardsScreen from './hub/RewardsScreen';
import SpritePreview from './hub/SpritePreview';
import { useSettings } from './core/settings';
import { useRewards } from './core/RewardService';
import { usePlayGames } from './core/playGames/service';
import ParticleOverlay from './anim/ParticleOverlay';
import RouteTransition from './anim/RouteTransition';

export default function App() {
  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateRewards = useRewards((s) => s.hydrate);
  // Sesión de Google Play Juegos: silenciosa y sin bloquear nada (en web y en
  // dispositivos sin Play Juegos se queda en 'unavailable').
  const hydratePlayGames = usePlayGames((s) => s.hydrate);
  useEffect(() => {
    void hydrateSettings();
    void hydrateRewards();
    void hydratePlayGames();
  }, [hydrateSettings, hydrateRewards, hydratePlayGames]);

  return (
    <>
      <ParticleOverlay />
      <RouteTransition>
        <Routes>
          <Route path="/" element={<HubScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/records" element={<RecordsScreen />} />
          <Route path="/rewards" element={<RewardsScreen />} />
          <Route path="/sprites" element={<SpritePreview />} />
          <Route path="/game/:id" element={<GameHost />} />
        </Routes>
      </RouteTransition>
    </>
  );
}
