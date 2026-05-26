import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import HubScreen from './hub/HubScreen';
import GamePlaceholder from './hub/GamePlaceholder';
import SettingsScreen from './hub/SettingsScreen';
import RecordsScreen from './hub/RecordsScreen';
import { useSettings } from './core/settings';

export default function App() {
  const hydrate = useSettings((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <Routes>
      <Route path="/" element={<HubScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/records" element={<RecordsScreen />} />
      <Route path="/game/:id" element={<GamePlaceholder />} />
    </Routes>
  );
}
