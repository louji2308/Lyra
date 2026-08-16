import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <p className="text-5xl font-bold text-zinc-200">404</p>
      <h2 className="mt-3 text-sm font-semibold text-zinc-900">
        Page not found
      </h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/shops"
        className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Go to Shops
      </Link>
    </div>
  );
}
