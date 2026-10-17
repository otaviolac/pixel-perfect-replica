import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "App Aerodesign" },
      { name: "description", content: "Gestão interna da equipe universitária de Aerodesign." },
      { property: "og:title", content: "App Aerodesign" },
      { property: "og:description", content: "Gestão interna da equipe universitária de Aerodesign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/inicio" : "/auth" });
  },
});
