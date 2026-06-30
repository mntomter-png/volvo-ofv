import { requirePageAccess } from "@/lib/auth/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("admin");
  return children;
}
