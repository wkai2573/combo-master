import { useState } from 'react';
import type { Session } from '../net/session';
import { Battle } from './pages/Battle';
import { DeckBuilder } from './pages/DeckBuilder';
import { Home, type Route } from './pages/Home';
import { Lobby, type LobbyMode } from './pages/Lobby';
import { Records } from './pages/Records';
import { KeywordTooltip } from './components/KeywordText';

function Routes() {
  const [route, setRoute] = useState<Route>('home');
  const [session, setSession] = useState<Session | null>(null);

  if (session) {
    return (
      <Battle
        session={session}
        onExit={() => {
          setSession(null);
          setRoute('home');
        }}
      />
    );
  }
  if (route === 'decks') return <DeckBuilder onBack={() => setRoute('home')} />;
  if (route === 'records') return <Records onBack={() => setRoute('home')} />;
  if (route === 'host' || route === 'join' || route === 'practice') {
    return <Lobby mode={route as LobbyMode} onStart={setSession} onBack={() => setRoute('home')} />;
  }
  return <Home go={setRoute} />;
}

export function App() {
  return (
    <>
      <Routes />
      <KeywordTooltip />
    </>
  );
}
