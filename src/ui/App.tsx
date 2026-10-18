import { useState } from 'react';
import { TutorialSession, type Session } from '../net/session';
import { Battle } from './pages/Battle';
import { DeckBuilder } from './pages/DeckBuilder';
import { Home, type Route } from './pages/Home';
import { Lobby, type LobbyMode } from './pages/Lobby';
import { Records } from './pages/Records';
import { CorruptDecksDialog } from './components/CorruptDecksDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeywordTooltip } from './components/KeywordText';

function Routes() {
  const [route, setRoute] = useState<Route>('home');
  const [session, setSession] = useState<Session | null>(null);

  // 教學不經過選牌：按下去直接建立場次
  const go = (r: Route) => (r === 'tutorial' ? setSession(new TutorialSession()) : setRoute(r));

  if (session) {
    return (
      <Battle
        session={session}
        onExit={() => {
          setSession(null);
          setRoute('home');
        }}
        onPractice={() => {
          setSession(null);
          setRoute('practice');
        }}
      />
    );
  }
  if (route === 'decks') return <DeckBuilder onBack={() => setRoute('home')} />;
  if (route === 'records') return <Records onBack={() => setRoute('home')} />;
  if (route === 'host' || route === 'join' || route === 'practice') {
    return <Lobby mode={route as LobbyMode} onStart={setSession} onBack={() => setRoute('home')} />;
  }
  return <Home go={go} />;
}

export function App() {
  return (
    <>
      <ErrorBoundary>
        <Routes />
      </ErrorBoundary>
      <CorruptDecksDialog />
      <KeywordTooltip />
    </>
  );
}
