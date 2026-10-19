import { useRef, useState } from 'react';
import { TutorialSession, type Session } from '../net/session';
import { getLesson } from '../tutorial/lessons';
import { Battle } from './pages/Battle';
import { DeckBuilder } from './pages/DeckBuilder';
import { Home, type Route } from './pages/Home';
import { Lessons } from './pages/Lessons';
import { Lobby, type LobbyMode } from './pages/Lobby';
import { Records } from './pages/Records';
import { CorruptDecksDialog } from './components/CorruptDecksDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KeywordTooltip } from './components/KeywordText';

function Routes() {
  const [route, setRoute] = useState<Route>('home');
  const [session, setSession] = useState<Session | null>(null);
  // 換了場次就整個戰鬥畫面重新掛載（下一課接在上一課後面時，不能沿用上一場的畫面狀態）
  const serial = useRef(0);
  const begin = (s: Session) => {
    serial.current++;
    setSession(s);
  };

  // 教學不經過選牌：從課程清單挑一課，直接建立場次
  const startLesson = (no: number) => begin(new TutorialSession(undefined, getLesson(no)));
  // 教學中離開回到課程清單，其他對局回主畫面
  const leaveTo = (to: Route) => {
    setSession(null);
    setRoute(to);
  };

  if (session) {
    const tutorial = session instanceof TutorialSession;
    return (
      <Battle
        key={serial.current}
        session={session}
        onExit={() => leaveTo(tutorial ? 'tutorial' : 'home')}
        onPractice={() => leaveTo('practice')}
        onLesson={startLesson}
      />
    );
  }
  if (route === 'decks') return <DeckBuilder onBack={() => setRoute('home')} />;
  if (route === 'records') return <Records onBack={() => setRoute('home')} />;
  if (route === 'tutorial') return <Lessons onStart={startLesson} onBack={() => setRoute('home')} />;
  if (route === 'host' || route === 'join' || route === 'practice') {
    return <Lobby mode={route as LobbyMode} onStart={begin} onBack={() => setRoute('home')} />;
  }
  return <Home go={setRoute} />;
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
