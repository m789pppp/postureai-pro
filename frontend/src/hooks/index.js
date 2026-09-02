/**
 * Corvus — Custom React Hooks v2
 * All reusable hooks — auth, toasts, online, keyboard, storage, debounce, idle
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  onAuthStateChanged, checkAndDowngradeTrial, getUserProfile,
  checkAndSendNurtureEmails, saveCalibration, getCalibration,
} from "../firebase.js";
import { clearTokenCache, AdminAPI } from "../services/api.js";
import { API_BASE_URL } from "../config/api.js";

const API_URL = API_BASE_URL;

// ── useAuth ────────────────────────────────────────────────────────
export function useAuth() {
  const [user,        setUser]    = useState(null);
  const [profile,     setProfile] = useState(null);
  const [authLoading, setLoading] = useState(true);
  const [authError,   setError]   = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (u) => {
      setLoading(true);
      if (u) {
        setUser(u);
        try {
          let p = await checkAndDowngradeTrial(u.uid);
          if (!p) p = await getUserProfile(u.uid);
          setProfile(p);
          checkAndSendNurtureEmails(u.uid, p, API_URL).catch(() => {});
        } catch (e) { setError(e.message); }
      } else {
        setUser(null);
        setProfile(null);
        clearTokenCache();
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try { setProfile(await getUserProfile(user.uid)); } catch {}
  }, [user]);

  return { user, profile, authLoading, authError, refreshProfile };
}

// ── useBackendHealth ───────────────────────────────────────────────
export function useBackendHealth() {
  const [health,        setHealth]  = useState(null);
  const [backendOnline, setOnline]  = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await AdminAPI.health();
        setHealth(data);
        setOnline(data?.status === "ok");
      } catch { setOnline(false); }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  return { health, backendOnline };
}

// ── useToasts ─────────────────────────────────────────────────────
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  // The same sentence, twice, one above the other.
  //
  // Error toasts are permanent (dur=0 below), so any message raised from two
  // places — or from one place that ran twice before its guard flag settled —
  // stacked as two identical rows that each had to be dismissed by hand. It
  // reads as two separate faults when there is only one. Reported live for
  // "Can't reach the analysis server", which the Live page also renders as a
  // full-screen overlay AND in its alert box, so one outage could say the same
  // thing four times at once.
  //
  // A toast whose text and type are already on screen refreshes that toast
  // instead of adding another. Nothing is lost, and a repeat of a message the
  // user is already reading costs nothing.
  //
  // The visible list is mirrored in a ref because the de-duplication decision
  // has to be made synchronously, at call time: reading it inside a setToasts
  // updater would run after this function returned (and after two calls in the
  // same tick had both already decided they were unique).
  const listRef   = useRef([]);
  const timersRef = useRef(new Map());
  const commit = useCallback(next => { listRef.current = next; setToasts(next); }, []);

  const addToast = useCallback((text, type = "info", duration) => {
    // Arabic text needs more reading time — auto-detect RTL characters
    const isArabic = /[؀-ۿ]/.test(text);
    const dur = duration ?? (type === "error" ? 0 : isArabic ? 5500 : 3500);
    const dupe = listRef.current.find(t => t.text === text && t.type === type);
    const id = dupe ? dupe.id : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!dupe) commit([...listRef.current.slice(-5), { id, text, type }]); // max 6 toasts
    // Re-arm rather than leaving the first copy to expire on its old schedule.
    const prev = timersRef.current.get(id);
    if (prev) { clearTimeout(prev); timersRef.current.delete(id); }
    // Error toasts stay until dismissed (dur=0 means permanent)
    if (dur > 0) {
      timersRef.current.set(id, setTimeout(() => {
        timersRef.current.delete(id);
        commit(listRef.current.filter(t => t.id !== id));
      }, dur));
    }
    return id;
  }, [commit]);

  const dismiss = useCallback(id => {
    const h = timersRef.current.get(id);
    if (h) { clearTimeout(h); timersRef.current.delete(id); }
    commit(listRef.current.filter(t => t.id !== id));
  }, [commit]);

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  return { toasts, addToast, dismiss };
}

// ── useMediaQuery ─────────────────────────────────────────────────
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = e => setMatches(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return matches;
}

// ── useLocalStorage ───────────────────────────────────────────────
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((newVal) => {
    setValue(newVal);
    try { localStorage.setItem(key, JSON.stringify(newVal)); } catch {}
  }, [key]);
  return [value, set];
}

// ── useKeyboardShortcut ───────────────────────────────────────────
export function useKeyboardShortcut(key, callback, deps = []) {
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === key) {
        e.preventDefault();
        callback(e);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
}

// ── useOnline ─────────────────────────────────────────────────────
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// ── useDebounce ───────────────────────────────────────────────────
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── usePrevious ───────────────────────────────────────────────────
export function usePrevious(value) {
  const ref = useRef(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}

// ── useIdleTimer ──────────────────────────────────────────────────
export function useIdleTimer(onIdle, idleMs = 300000) {
  const timer  = useRef(null);
  const reset  = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onIdle, idleMs);
  }, [onIdle, idleMs]);

  useEffect(() => {
    const events = ["mousedown","mousemove","keypress","scroll","touchstart"];
    events.forEach(e => document.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach(e => document.removeEventListener(e, reset));
      clearTimeout(timer.current);
    };
  }, [reset]);
}

// ── useIntersection ───────────────────────────────────────────────
export function useIntersection(ref, options = {}) {
  const [isVisible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1, ...options }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, options]);
  return isVisible;
}

// ── useCalibration ────────────────────────────────────────────────
export function useCalibration(uid) {
  const [calibration, setCalib]   = useState(null);
  const [calibLoading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getCalibration(uid)
      .then(c => setCalib(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  const saveCalib = useCallback(async (data) => {
    if (!uid) return;
    await saveCalibration(uid, data);
    setCalib(data);
  }, [uid]);

  return { calibration, calibLoading, saveCalib };
}
