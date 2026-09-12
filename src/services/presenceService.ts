import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../config/firebase';

export class PresenceService {
  private static activeUid: string | null = null;
  private static connectedUnsub: (() => void) | null = null;

  /**
   * Sets up automated online / offline presence in Firebase Realtime Database
   */
  static startPresence(uid: string): void {
    if (!rtdb || !uid) return;
    if (this.activeUid === uid) return;
    this.stopPresence();
    this.activeUid = uid;

    const userStatusDatabaseRef = ref(rtdb, `/presence/${uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    this.connectedUnsub = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) {
        return;
      }

      onDisconnect(userStatusDatabaseRef)
        .set({
          online: false,
          lastSeen: serverTimestamp(),
        })
        .then(() => {
          set(userStatusDatabaseRef, {
            online: true,
            lastSeen: serverTimestamp(),
          }).catch(() => {});
        })
        .catch(() => {});
    });
  }

  /**
   * Stops tracking presence on logout
   */
  static stopPresence(): void {
    if (this.connectedUnsub) {
      this.connectedUnsub();
      this.connectedUnsub = null;
    }
    if (this.activeUid && rtdb) {
      const userStatusDatabaseRef = ref(rtdb, `/presence/${this.activeUid}`);
      set(userStatusDatabaseRef, {
        online: false,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
      this.activeUid = null;
    }
  }
}
