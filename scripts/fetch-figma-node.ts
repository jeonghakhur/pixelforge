/**
 * Figma 노드 데이터를 JSON으로 저장하는 스크립트
 *
 * 사용법:
 *   FIGMA_TOKEN=figd_xxx npx tsx scripts/fetch-figma-node.ts <FILE_KEY> <NODE_ID> [output.json]
 *
 * 예시:
 *   FIGMA_TOKEN=figd_xxx npx tsx scripts/fetch-figma-node.ts zfG6A4VYBeW6EXZKlveUd3 120085:168888
 */

const FILE_KEY = process.argv[2];
const NODE_ID = process.argv[3];
const OUTPUT_PATH = process.argv[4] ?? `data/figma-node-${NODE_ID?.replace(':', '-')}.json`;

async function main() {
  if (!FILE_KEY || !NODE_ID) {
    process.stderr.write(
      '사용법: FIGMA_TOKEN=figd_xxx npx tsx scripts/fetch-figma-node.ts <FILE_KEY> <NODE_ID> [output.json]\n'
    );
    process.exit(1);
  }

  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    process.stderr.write(
      'FIGMA_TOKEN 환경변수가 필요합니다.\n' +
      '사용법: FIGMA_TOKEN=figd_xxx npx tsx scripts/fetch-figma-node.ts <FILE_KEY> <NODE_ID>\n'
    );
    process.exit(1);
  }

  const url = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(NODE_ID)}`;

  process.stderr.write(`Fetching node ${NODE_ID} from file ${FILE_KEY}...\n`);

  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });

  if (!res.ok) {
    const body = await res.text();
    process.stderr.write(`Figma API error (${res.status}): ${body}\n`);
    process.exit(1);
  }

  const data = await res.json();

  // data 디렉토리 생성
  const fs = await import('fs');
  const path = await import('path');
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  process.stderr.write(`Saved to ${OUTPUT_PATH}\n`);

  // 간단한 요약 출력
  const nodeData = data.nodes?.[NODE_ID];
  if (nodeData?.document) {
    const doc = nodeData.document;
    process.stderr.write(`\nNode summary:\n`);
    process.stderr.write(`  Name: ${doc.name}\n`);
    process.stderr.write(`  Type: ${doc.type}\n`);
    process.stderr.write(`  Children: ${doc.children?.length ?? 0}\n`);
  }
}

main();
