export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-foreground/10 bg-white/5 p-8 backdrop-blur-md">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-2 text-foreground/70">
          This is a minimal landing page. Go to{" "}
          <a className="underline" href="/upload">
            /upload
          </a>{" "}
          to start uploading.
        </p>
      </div>
    </div>
  );
}
