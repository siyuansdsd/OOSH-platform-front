export const metadata = {
  title: "Upload",
};
import UploadFormClient from "@/components/upload/UploadFormClient";

export default function UploadPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <UploadFormClient />
    </div>
  );
}
