export const metadata = {
  title: "Upload",
};
import UploadFormClient from "@/components/upload/UploadFormClient";

export default function UploadPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">/upload</h1>
      <UploadFormClient />
    </div>
  );
}
