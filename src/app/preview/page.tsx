import EditionPreview from "./EditionPreview";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <EditionPreview date={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined} />;
}
