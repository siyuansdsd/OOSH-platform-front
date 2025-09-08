export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-7xl font-bold tracking-tight">404</div>
        <p className="mt-2 text-lg text-foreground/70">Page not found</p>
        <a
          className="mt-6 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-white font-medium shadow-lg shadow-blue-600/20"
          href="/"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
