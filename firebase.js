// Conexão com o Firebase: login Google e banco de dados (Firestore).
// As chaves abaixo identificam o projeto e podem ficar públicas.
// Quem protege os dados são as regras do Firestore (arquivo firestore.rules).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYWKlGkYqjAGLGwSPt4yUZbvf-cxP7SBk",
  authDomain: "diario-de-missoes.firebaseapp.com",
  projectId: "diario-de-missoes",
  storageBucket: "diario-de-missoes.firebasestorage.app",
  messagingSenderId: "3331401531",
  appId: "1:3331401531:web:092dc0a52c9d95673df91e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Cache local: as missões continuam visíveis mesmo sem internet.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
    } else {
      throw e;
    }
  }
}

export const logout = () => signOut(auth);
export const watchUser = (cb) => onAuthStateChanged(auth, cb);

// Dados de cada pessoa ficam em users/{uid}/tasks/{id}
export function watchTasks(uid, onData, onError) {
  return onSnapshot(collection(db, "users", uid, "tasks"), (snap) => {
    const map = new Map();
    snap.forEach((d) => map.set(d.id, d.data()));
    onData(map);
  }, onError);
}
export const saveTask = (uid, id, data) => setDoc(doc(db, "users", uid, "tasks", id), data);
export const deleteTask = (uid, id) => deleteDoc(doc(db, "users", uid, "tasks", id));
