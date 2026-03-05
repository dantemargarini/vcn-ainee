import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white">
      <h1 className="text-xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-600 text-sm">This page does not exist.</p>
      <Link
        href="/"
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Go home
      </Link>
    </div>
  );
}
