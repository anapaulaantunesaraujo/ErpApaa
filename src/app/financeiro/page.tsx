import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MainHeader from "@/components/MainHeader";
import FinanceiroClient from "./FinanceiroClient";

export default async function FinanceiroPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <MainHeader user={user} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FinanceiroClient user={user} />
      </main>
    </div>
  );
}

