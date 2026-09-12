interface RatePlayer { playbackRate: number }

export function createTemporaryPlaybackRate(player: RatePlayer, preferredRate: () => number) {
  let active = false;
  return {
    get isActive() { return active; },
    begin() {
      if (active) return false;
      player.playbackRate = 2;
      active = true;
      return true;
    },
    end() {
      if (!active) return false;
      active = false;
      player.playbackRate = preferredRate();
      return true;
    },
  };
}
