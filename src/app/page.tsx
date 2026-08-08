import { redirect } from "next/navigation";
import { getAuthProvider } from "@/lib/providers/auth/registry";

export default async function RootPage() {
  const session = await getAuthProvider().getSession();
  redirect(session ? "/dashboard" : "/login");
}
