import { HubspotLoginClient } from "../HubspotLoginClient";

interface HubspotLoginPageProps {
  params: { contactId: string };
}

export const metadata = {
  title: "Hub user login",
};

export default function HubspotLoginPage({ params }: HubspotLoginPageProps) {
  return <HubspotLoginClient contactId={params.contactId} />;
}
