import { notFound } from 'next/navigation';
import { getComponentByName, validateComponentCssVars } from '@/lib/actions/components';
import ComponentGuideClient from './ComponentGuideClient';

interface ComponentPageProps {
  params: Promise<{ name: string }>;
}

export default async function ComponentPage({ params }: ComponentPageProps) {
  const { name } = await params;
  const row = await getComponentByName(name);
  if (!row) notFound();

  const missingVars = await validateComponentCssVars(row.css ?? null);

  return (
    <ComponentGuideClient
      id={row.id}
      name={row.name}
      category={row.category}
      detectedType={row.detectedType ?? null}
      tsx={row.tsx ?? null}
      css={row.css ?? null}
      radixProps={row.radixProps ?? null}
      version={row.version ?? 1}
      missingVars={missingVars}
    />
  );
}
