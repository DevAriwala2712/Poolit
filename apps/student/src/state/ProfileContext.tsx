import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface Profile {
  name: string;
  hostelId: string;
  block: string;
  room: string;
  onboarded: boolean;
  favorites: string[];
  walletBalance: number;
}

const DEFAULT_PROFILE: Profile = {
  name: "",
  hostelId: "h1",
  block: "Block A",
  room: "312",
  onboarded: false,
  favorites: [],
  walletBalance: 480,
};

const KEY = "poolit-student-profile-v1";

interface ProfileContextValue {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  toggleFavorite: (menuItemId: string) => void;
  isFavorite: (menuItemId: string) => boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
    } catch {
      // fall through to defaults
    }
    return DEFAULT_PROFILE;
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(profile));
  }, [profile]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      update: (patch) => setProfile((p) => ({ ...p, ...patch })),
      toggleFavorite: (id) =>
        setProfile((p) => ({
          ...p,
          favorites: p.favorites.includes(id)
            ? p.favorites.filter((f) => f !== id)
            : [...p.favorites, id],
        })),
      isFavorite: (id) => profile.favorites.includes(id),
    }),
    [profile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
