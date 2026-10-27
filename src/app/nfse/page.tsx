import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MainHeader from "@/components/MainHeader";
import NfseClient from "./NfseClient";

export default async function NfsePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <MainHeader user={user} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NfseClient user={user} />
      </main>
    </div>
  );
}

