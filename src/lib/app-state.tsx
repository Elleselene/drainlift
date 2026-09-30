import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";

// App-wide state (theme, TOTOONG Supabase login session, at profile info).
// Gumamit ako ng React Context para hindi na kailangan mag-pass ng props sa bawat page.

type Theme = "dark" | "light";

// Mga info ng user na naka-store sa Supabase "profiles" table (email ay galing sa
// Supabase Auth session mismo, hindi na kailangang doblehin dito)
type Profile = {
  name: string;
  phone: string;
  role: string;
};

const EMPTY_PROFILE: Profile = { name: "", phone: "", role: "" };

// Lahat ng laman ng context (values at functions na pwedeng gamitin ng ibang components)
type AppState = {
  theme: Theme;
  toggleTheme: () => void;
  signedIn: boolean;
  authLoading: boolean; // true habang tinitignan pa kung may existing session
  email: string; // galing mismo sa Supabase Auth session, hindi na-e-edit dito
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  profile: Profile;
  updateProfile: (p: Partial<Profile>) => Promise<{ error: string | null }>;
  demoMode: boolean;
};

// Yung mismong context. null muna ang default kasi provider ang magbibigay ng value
const Ctx = createContext<AppState | null>(null);

// Key na gamit sa localStorage — theme lang ang natitirang naka-localStorage dito ngayon
// (ang session mismo ay hawak na ng Supabase, awtomatiko na nitong ino-store sa browser)
const THEME_KEY = "drainlift.theme";

// Kunin ang profile row (name, phone, role) galing sa Supabase "profiles" table, base sa
// session ng naka-login na user
async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, phone, role")
    .eq("id", userId)
    .single();
  if (error || !data) return EMPTY_PROFILE;
  return data as Profile;
}

// Provider na bumabalot sa buong app (nakalagay sa __root.tsx)
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);

  // Pag na-load ang page: (1) kunin ang naka-save na theme, (2) tingnan kung may existing
  // Supabase session na (auto-login kung dati nang naka-sign in), (3) makinig sa susunod na
  // pagbabago ng session (sign in / sign out sa ibang tab, token refresh, atbp.)
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) setTheme(storedTheme);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Tuwing may session (naka-login), kunin ang profile info galing sa Supabase.
  // Tuwing wala (naka-logout), i-clear ang profile.
  useEffect(() => {
    if (session?.user) {
      fetchProfile(session.user.id).then(setProfile);
    } else {
      setProfile(EMPTY_PROFILE);
    }
  }, [session?.user.id]);

  // Pag nagbago ang theme, i-toggle yung "dark" class sa <html> para mag-apply yung dark colors
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Palit dark <-> light tapos i-save sa localStorage
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  // TOTOONG login gamit ang Supabase Auth (email + password)
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  // Logout: tatanggalin ni Supabase ang session
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // I-update yung profile row sa Supabase "profiles" table (RLS: sarili lang ng user ang
  // pwede niyang i-update, kaya safe direktang tawagin ito mula sa browser)
  const updateProfile = useCallback(
    async (p: Partial<Profile>) => {
      if (!session?.user) return { error: "Not signed in" };
      const { error } = await supabase.from("profiles").update(p).eq("id", session.user.id);
      if (error) return { error: error.message };
      setProfile((prev) => ({ ...prev, ...p }));
      return { error: null };
    },
    [session?.user.id],
  );

  // useMemo para hindi mag-re-render ang lahat ng components kung walang nagbago sa value
  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      signedIn: session !== null,
      authLoading,
      email: session?.user.email ?? "",
      signIn,
      signOut,
      profile,
      updateProfile,
      demoMode: false,
    }),
    [theme, toggleTheme, session, authLoading, signIn, signOut, profile, updateProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Custom hook para madaling makuha ang app state: const { theme, signOut } = useAppState()
export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
