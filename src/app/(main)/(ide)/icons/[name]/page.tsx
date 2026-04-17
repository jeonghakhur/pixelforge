export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getIconByComponentName } from '@/lib/actions/icons';
import IconDetailClient from './IconDetailClient';
import styles from './page.module.scss';

interface Props {
  params: Promise<{ name: string }>;
}

export default async function IconDetailPage({ params }: Props) {
  const { name } = await params;

  // URL: /icons/IconArrowLeft → componentName: ArrowLeft
  const componentName = name.startsWith('Icon') ? name.slice(4) : name;

  const icon = await getIconByComponentName(componentName);
  if (!icon) notFound();

  return (
    <div className={styles.page}>
      <IconDetailClient
        componentName={componentName}
        figmaName={icon.name}
        section={icon.section ?? '기타'}
        svg={icon.svg}
        variants={icon.variants}
      />
    </div>
  );
}
