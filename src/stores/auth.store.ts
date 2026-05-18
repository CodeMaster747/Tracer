import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile,
  type User as FirebaseUser,
  type AuthError,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  init: () => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function toAppUser(u: FirebaseUser): AppUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

function isPopupBlockedError(err: unknown): boolean {
  const code = (err as AuthError | undefined)?.code ?? '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/cancelled-popup-request'
  );
}

function friendlyAuthError(err: unknown): string {
  const code = (err as AuthError | undefined)?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No account exists for that email.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email exists with a different sign-in method.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before completion.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for Google sign-in. Add it in the Firebase console under Authentication → Settings → Authorized domains.';
    default:
      return (err as Error)?.message ?? 'Something went wrong. Please try again.';
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  error: null,

  init: () => {
    if (get().initialized) return;

    onAuthStateChanged(auth, (u) => {
      set({ user: u ? toAppUser(u) : null, initialized: true });
    });

    // Complete redirect-based sign-in (used when popup is blocked).
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          set({ user: toAppUser(result.user) });
        }
      })
      .catch((e) => {
        set({ error: friendlyAuthError(e) });
      });
  },

  signInEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      set({ user: toAppUser(cred.user) });
    } catch (e) {
      const msg = friendlyAuthError(e);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  signUpEmail: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name?.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      set({ user: toAppUser(cred.user) });
    } catch (e) {
      const msg = friendlyAuthError(e);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  signInGoogle: async () => {
    set({ loading: true, error: null });
    try {
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        set({ user: toAppUser(cred.user) });
      } catch (popupErr) {
        if (isPopupBlockedError(popupErr)) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }
    } catch (e) {
      const msg = friendlyAuthError(e);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await signOut(auth);
      set({ user: null });
    } catch (e) {
      set({ error: friendlyAuthError(e) });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
