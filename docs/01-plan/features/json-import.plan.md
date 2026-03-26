# JSON Import — Plan

## 개요
Figma 플러그인에서 내보낸 PixelForge JSON 파일을 PixelForge에 임포트하는 기능.
파일 첨부 또는 클립보드 붙여넣기 두 가지 경로를 지원한다.

## 배경 & 동기
- Figma Variables API는 파일 소유자/편집 권한 필요 → 커뮤니티 파일 불가
- Figma 플러그인은 열람 권한만 있으면 Variables 읽기 가능
- VARIABLE_ALIAS 해소 등 컴포넌트 생성에 필요한 데이터를 플러그인에서 완전 처리 후 내보낼 수 있음
- **플러그인 방식이 primary 경로**, Figma URL 방식은 소유 파일 빠른 동기화용으로 유지

## PixelForge JSON 포맷 (`PixelForgeJson`)
```json
{
  "meta": {
    "figmaFileKey": "...",
    "fileName": "...",
    "extractedAt": "ISO 8601",
    "sourceMode": "selection | full",
    "totalNodes": 147
  },
  "variables": {
    "collections": [{ "id", "name", "modes": [{ "modeId", "name" }], "variableIds": [] }],
    "variables": [{ "id", "name", "resolvedType": "COLOR|FLOAT|STRING|BOOLEAN", "valuesByMode": {}, "collectionId" }]
  },
  "styles": {
    "colors": [{ "id", "name", "paints": [{ "type", "color", "opacity" }] }],
    "texts": [{ "id", "name", "fontName", "fontSize", "fontWeight", "letterSpacing", "lineHeight" }]
  }
}
```

## 구현된 기능

### 1. 서버 액션 (`src/lib/actions/import-json.ts`)
- `importFromJsonAction(data: PixelForgeJson): Promise<ImportJsonResult>`
- `json-import` 고정 figmaKey로 프로젝트 식별 (공용 프로젝트)
- Variables COLOR → color 토큰 (VARIABLE_ALIAS 제외, mode별 저장)
- Variables 없으면 styles.colors 폴백
- styles.texts → typography 토큰
- 기존 토큰 전체 삭제 후 재삽입 (버전 갱신)

### 2. JSON 분석 패널 (`src/app/(ide)/JsonAnalysisPanel.tsx`)
- Variables collections별 색상 스와치 / Float 값 / Alias 목록 표시
- Styles 색상 스와치 그리드 / 타이포그래피 목록
- 임포트할 토큰 수 요약 + "모든 토큰 가져오기" 버튼

### 3. 홈 페이지 임포트 (`src/app/(ide)/page.tsx`)
- Figma URL 입력 영역 하단 "또는" 구분선
- Textarea 붙여넣기 방식 (onPaste 즉시 파싱 / 분석 버튼 수동 파싱)

### 4. 토큰 타입 페이지 임포트 (`src/app/(ide)/tokens/[type]/JsonImportSection.tsx`)
- **빈 상태**: stageInner 영역에 JsonImportSection 표시 (접힘 없음)
- **토큰 있을 때**: 토큰 그리드 하단 토글 섹션 (`collapsed={true}`)
- 파일 첨부 (hidden input) + textarea 붙여넣기 + 드래그앤드롭 통합
- onPaste 즉시 파싱 → JsonAnalysisPanel 표시
- 임포트 후 `router.refresh()` → 서버 컴포넌트 토큰 목록 갱신

## 디렉토리 구조
```
src/
├── lib/actions/
│   └── import-json.ts          # 서버 액션
├── app/(ide)/
│   ├── JsonAnalysisPanel.tsx   # 분석 결과 표시 컴포넌트
│   ├── JsonAnalysisPanel.module.scss
│   ├── page.tsx                # 홈 - textarea 붙여넣기
│   └── tokens/[type]/
│       └── JsonImportSection.tsx  # 토큰 타입 페이지용 임포트 섹션
```

## 미결 과제
- [ ] 플러그인 개발: Figma 플러그인에서 PixelForge JSON 내보내기
- [ ] Variables FLOAT → spacing/radius 토큰 매핑 (현재 color/typography만)
- [ ] VARIABLE_ALIAS 해소 후 semantic token 지원
- [ ] json-import 프로젝트와 Figma URL 프로젝트 토큰 통합 뷰
