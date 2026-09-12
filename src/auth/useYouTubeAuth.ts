import { useEffect, useState } from 'react';
import { YouTubeAuthService } from '../services/youtubeAuthService';

export function useYouTubeAuth() {
  const [state, setState] = useState({ authenticated: false, ready: false, revision: 0 });
  useEffect(() => {
    let active = true;
    let changed = false;
    const unsubscribe = YouTubeAuthService.subscribe((authenticated) => {
      changed = true;
      setState((previous) => ({ authenticated, ready: true, revision: previous.revision + 1 }));
    });
    void YouTubeAuthService.isAuthenticated().then((authenticated) => {
      if (active && !changed) setState({ authenticated, ready: true, revision: 0 });
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  return state;
}
