import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Calendar,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  SquarePen,
} from "lucide-react";
import { AppShell } from "@/components/dl/AppShell";
import {
  Button,
  Card,
  InfoCard,
  SectionTitle,
  StatusPill,
} from "@/components/dl/primitives";
import { useAppState } from "@/lib/app-state";
import { currentUser, device } from "@/lib/drainlift";

// Profile page (URL: "/profile"): info ng admin at ng device, may edit form para sa account
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Admin Profile — DrainLift" },
      {
        name: "description",
        content:
          "Facility administrator account details and managed DrainLift device information.",
      },
      { property: "og:title", content: "Admin Profile — DrainLift" },
      {
        property: "og:description",
        content: "Facility administrator information for the DrainLift unit.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, updateProfile, signOut } = useAppState();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false); // nakabukas ba yung edit form
  const [draft, setDraft] = useState(profile); // pansamantalang laman ng form (hindi pa saved)

  return (
    <AppShell title="Admin Profile" subtitle="Facility administrator information">
      <div className="space-y-6">
        {/* Profile card: initials, pangalan, role, at mga buttons */}
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-info to-primary font-mono text-xl font-bold text-primary-foreground">
              {currentUser.initials}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold">{profile.name}</h2>
              <p className="font-mono text-xs text-muted-foreground">
                {currentUser.handle}
              </p>
              <StatusPill tone="primary" className="mt-2">
                {currentUser.role}
              </StatusPill>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Edit Info: buksan/isara ang form, at i-reset ang draft sa kasalukuyang profile */}
              <Button
                onClick={() => {
                  setDraft(profile);
                  setEditing((e) => !e);
                }}
              >
                <SquarePen className="h-4 w-4" /> Edit Info
              </Button>
              {/* Logout: i-sign out tapos balik sa login page */}
              <Button
                variant="danger"
                onClick={() => {
                  signOut();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>
          </div>
        </Card>

        {/* Edit form, lalabas lang pag pinindot ang "Edit Info" */}
        {editing && (
          <Card className="p-5">
            <SectionTitle>Edit Account</SectionTitle>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                updateProfile(draft); // i-save yung pinalitan
                setEditing(false); // isara na yung form
              }}
            >
              {/* Name, Email, at Phone fields (gumamit ng array para hindi paulit-ulit ang code) */}
              {(
                [
                  ["Name", "name"],
                  ["Email", "email"],
                  ["Phone", "phone"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="block">
                  <span className="dl-label">{label}</span>
                  <input
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                  />
                </label>
              ))}
              {/* Password field: design lang muna, wala pang backend kaya hindi pa nase-save */}
              <label className="block">
                <span className="dl-label">New Password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button variant="primary" type="submit">
                  Save Changes
                </Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {/* Device at account info (read-only) */}
        <div className="space-y-3">
          <SectionTitle>Admin Information</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard
              label="Managed Facility"
              value={device.owner}
              icon={<Building2 className="h-4 w-4" />}
            />
            <InfoCard
              label="Device ID"
              value={device.deviceNumber}
              icon={<KeyRound className="h-4 w-4" />}
            />
            <InfoCard
              label="Location"
              value={device.location}
              icon={<MapPin className="h-4 w-4" />}
            />
            <InfoCard
              label="Installed Since"
              value={device.installationDate}
              icon={<Calendar className="h-4 w-4" />}
            />
            <InfoCard
              label="Email"
              value={profile.email}
              icon={<Mail className="h-4 w-4" />}
            />
            <InfoCard
              label="Phone"
              value={profile.phone}
              icon={<Phone className="h-4 w-4" />}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Device details are managed by the facility admin role and can't be edited
            here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
