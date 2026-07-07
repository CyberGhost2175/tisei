import { ExecutorKpiDetailContent } from "./ExecutorKpiDetailContent";

export default async function ExecutorKpiDetailPage({
  params,
}: {
  params: Promise<{ executorId: string }>;
}) {
  const { executorId } = await params;
  return <ExecutorKpiDetailContent executorId={executorId} />;
}
