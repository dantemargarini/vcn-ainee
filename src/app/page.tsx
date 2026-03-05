import SyncFromGHL from "@/components/SyncFromGHL";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Veteran Career Networks
      </h1>
      <p className="mt-2 text-gray-600">Ainee — SMS Sales Agent</p>
      <p className="mt-4 text-sm text-gray-500">
        Step 1 + 2: Supabase connected. GHL sync below.
      </p>
      <SyncFromGHL />
    </main>
  );
}
