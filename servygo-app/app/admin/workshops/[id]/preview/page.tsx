import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminWorkshopPreviewRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/workshop-panel?adminPreview=1&workshopId=${encodeURIComponent(id)}`);
}
