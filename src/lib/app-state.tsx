import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { currentUser } from "./drainlift";

// App-wide state (theme, login session, at profile info).
// Gumamit ako ng React Context para hindi na kailangan mag-pass ng props sa bawat page.

type Theme = "dark" | "light";

// Mga info ng user na pwedeng i-edit sa Profile page
type Profile = {
  name: string;
  email: string;
  phone: string;
};

// Lahat ng laman ng context (values at functions na pwedeng gamitin ng ibang components)
type AppState = {
  theme: Theme;
  toggleTheme: () => void;
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  profile: Profile;
  updateProfile: (p: Partial<Profile>) => void;
  demoMode: boolean;
};

// Yung mismong context. null muna ang default kasi provider ang magbibigay ng value
const Ctx = createContext<AppState | null>(null);

// Mga key na gamit sa localStorage para hindi mawala ang settings pag nag-refresh
const THEME_KEY = "drainlift.theme";
const AUTH_KEY = "drainlift.session";
const PROFILE_KEY = "drainlift.profile";

// Provider na bumabalot sa buong app (nakalagay sa __root.tsx)
export function AppStateProvider({ children }: { children: ReactNode }) {
  // Default: dark theme, naka-sign in, at yung dummy user ang profile
  const [theme, setTheme] = useState<Theme>("dark");
  const [signedIn, setSignedIn] = useState(true);
  const [profile, setProfile] = useState<Profile>({
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
  });

  // Pag na-load ang page, kunin yung mga naka-save sa localStorage.
  // Sa useEffect ito ginawa kasi walang localStorage sa server (SSR).
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) setTheme(storedTheme);
    const session = localStorage.getItem(AUTH_KEY);
    if (session === "out") setSignedIn(false);
    const storedProfile = localStorage.getItem(PROFILE_KEY);
    if (storedProfile) {
      try {
        setProfile((p) => ({ ...p, ...JSON.parse(storedProfile) }));
      } catch {
        /* kung sira yung naka-save na JSON, huwag na lang pansinin */
      }
    }
  }, []);

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

  // Fake login lang ito (walang totoong backend), flag lang sa localStorage
  const signIn = useCallback(() => {
    localStorage.setItem(AUTH_KEY, "in");
    setSignedIn(true);
  }, []);

  // Logout: i-mark na "out" yung session
  const signOut = useCallback(() => {
    localStorage.setItem(AUTH_KEY, "out");
    setSignedIn(false);
  }, []);

  // I-update yung profile (kahit isa o dalawang field lang ang ipasa) tapos i-save
  const updateProfile = useCallback((p: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...p };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // useMemo para hindi mag-re-render ang lahat ng components kung walang nagbago sa value
  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      signedIn,
      signIn,
      signOut,
      profile,
      updateProfile,
      demoMode: false,
    }),
    [theme, toggleTheme, signedIn, signIn, signOut, profile, updateProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Custom hook para madaling makuha ang app state: const { theme, signOut } = useAppState()
export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
