import { Routes, Route } from 'react-router-dom';
import HubScreen from './hub/HubScreen';
import GamePlaceholder from './hub/GamePlaceholder';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HubScreen />} />
      <Route path="/game/:id" element={<GamePlaceholder />} />
    </Routes>
  );
}
