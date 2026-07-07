import { RequestDetail } from "./RequestDetail";

export default async function RequestCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
