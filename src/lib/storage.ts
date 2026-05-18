import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SolvedQuestion } from '@/engines/types';

/**
 * Cloud-backed storage for solved questions.
 * Documents live under /users/{uid}/questions/{id}.
 *
 * Every operation is wrapped with a short timeout so a missing/denied/offline
 * Firestore can never block the UI. Reads return their "empty" sentinel,
 * writes silently fail.  The app still works fully against the in-memory
 * session cache held in chat.store.
 */

const READ_TIMEOUT_MS = 4000;
const WRITE_TIMEOUT_MS = 6000;

function timeoutPromise<T>(ms: number, label: string): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Firestore ${label} timed out`)), ms));
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string, fallback: T): Promise<T> {
  try {
    return await Promise.race([p, timeoutPromise<T>(ms, label)]);
  } catch (err) {
    console.warn(`Firestore ${label} failed/skipped:`, (err as Error).message);
    return fallback;
  }
}

function userQuestionsRef(database: Firestore, uid: string) {
  return collection(database, 'users', uid, 'questions');
}

export async function saveQuestion(uid: string, question: SolvedQuestion): Promise<void> {
  const ref = doc(userQuestionsRef(db, uid), question.id);
  await withTimeout(setDoc(ref, { ...question, userId: uid }), WRITE_TIMEOUT_MS, 'saveQuestion', undefined);
}

export async function getQuestion(uid: string, id: string): Promise<SolvedQuestion | null> {
  const ref = doc(userQuestionsRef(db, uid), id);
  const snap = await withTimeout(getDoc(ref), READ_TIMEOUT_MS, 'getQuestion', null);
  if (!snap || !snap.exists()) return null;
  return snap.data() as SolvedQuestion;
}

export async function listHistory(uid: string): Promise<SolvedQuestion[]> {
  const q = query(userQuestionsRef(db, uid), orderBy('createdAt', 'desc'));
  const snap = await withTimeout(getDocs(q), READ_TIMEOUT_MS, 'listHistory', null);
  if (!snap) return [];
  return snap.docs.map((d) => d.data() as SolvedQuestion);
}

export async function listSaved(uid: string): Promise<SolvedQuestion[]> {
  const q = query(
    userQuestionsRef(db, uid),
    where('savedAt', '>', 0),
    orderBy('savedAt', 'desc')
  );
  const snap = await withTimeout(getDocs(q), READ_TIMEOUT_MS, 'listSaved', null);
  if (!snap) return [];
  return snap.docs.map((d) => d.data() as SolvedQuestion);
}

export async function setSaved(uid: string, id: string, saved: boolean): Promise<void> {
  const ref = doc(userQuestionsRef(db, uid), id);
  await withTimeout(updateDoc(ref, { savedAt: saved ? Date.now() : 0 }), WRITE_TIMEOUT_MS, 'setSaved', undefined);
}

export async function deleteQuestion(uid: string, id: string): Promise<void> {
  const ref = doc(userQuestionsRef(db, uid), id);
  await withTimeout(deleteDoc(ref), WRITE_TIMEOUT_MS, 'deleteQuestion', undefined);
}
