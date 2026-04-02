// @page Home — 토큰 대시보드
export const dynamic = 'force-dynamic';

import { getTokenSummary, getRecentHistoriesAction } from '@/lib/actions/tokens';
import { getTokenMenuAction } from '@/lib/actions/token-menu';
import { getSyncStatus } from '@/lib/actions/sync-status';
import TokenDashboard from './TokenDashboard';

export default async function HomePage() {
  const [summary, tokenMenu, histories, syncProjects] = await Promise.all([
    getTokenSummary(),
    getTokenMenuAction(),
    getRecentHistoriesAction(10),
    getSyncStatus(),
  ]);

  const tokenSync = syncProjects[0]?.syncs.find((s) => s.type === 'tokens');

  return (
    <TokenDashboard
      summary={summary}
      tokenMenu={tokenMenu}
      histories={histories}
      tokenVersion={tokenSync?.version ?? null}
      lastSyncedAt={tokenSync?.syncedAt?.toISOString() ?? summary.lastExtracted}
    />
  );
}
