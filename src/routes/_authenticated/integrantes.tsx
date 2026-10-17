import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/lib/me";
import { canManageMembersOperational } from "@/lib/permissions";
import { MembersManager } from "@/components/MembersManager";

export const Route = createFileRoute("/_authenticated/integrantes")({
  head: () => ({ meta: [{ title: "Integrantes — App Aerodesign" }, { name: "description", content: "Integrantes por setor." }] }),
  component: () => {
    const { data: me } = useMe();
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Integrantes</h1>
        <MembersManager canManage={canManageMembersOperational(me?.role)} via="operacional" />
      </div>
    );
  },
});
