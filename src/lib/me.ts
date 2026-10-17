import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "./permissions";

export type Me = {
  id: string;
  full_name: string;
  email: string;
  photo_path: string | null;
  birth_date: string | null;
  joined_at: string | null;
  phone: string | null;
  course: string | null;
  active: boolean;
  role: Role;
  sector_id: number;
  sector_name: string;
  isAdmin: boolean;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [p, m, a] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).single(),
      supabase.from("memberships").select("role, sector_id, sectors(name)").eq("user_id", u.user.id).single(),
      supabase.from("admin_access_grants").select("user_id").eq("user_id", u.user.id).maybeSingle(),
    ]);
    if (!p.data || !m.data) return null;
    return {
      ...p.data,
      role: m.data.role as Role,
      sector_id: m.data.sector_id,
      sector_name: (m.data.sectors as any)?.name ?? "",
      isAdmin: !!a.data,
    };
  },
});

export const useMe = () => useQuery(meQuery);

export const sectorsQuery = queryOptions({
  queryKey: ["sectors"],
  queryFn: async () => (await supabase.from("sectors").select("*").order("id")).data ?? [],
  staleTime: Infinity,
});

export const membersQuery = queryOptions({
  queryKey: ["members"],
  queryFn: async () => {
    const [p, m] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, active, photo_path, joined_at").order("full_name"),
      supabase.from("memberships").select("user_id, role, sector_id"),
    ]);
    const map = new Map((m.data ?? []).map((x) => [x.user_id, x]));
    return (p.data ?? []).map((x) => ({
      ...x,
      user_id: x.id,
      role: (map.get(x.id)?.role ?? "trainee") as Role,
      sector_id: map.get(x.id)?.sector_id ?? 1,
    }));
  },
});

export async function avatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
