import { ProfileSettingsClient } from "@/components/registers/profile-settings-client"
import { requireActiveUser } from "@/lib/supabase/auth"

export const dynamic = "force-dynamic"

export default async function MyProfilePage() {
  const auth = await requireActiveUser()

  if (!auth.ok) {
    return null
  }

  const profile = auth.profile as any

  return (
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <ProfileSettingsClient
        email={auth.user.email ?? ""}
        initialFullName={profile?.full_name ?? ""}
        role={profile?.role ?? "user"}
        status={profile?.status ?? "active"}
      />
    </div>
  )
}
