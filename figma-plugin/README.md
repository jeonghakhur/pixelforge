# PixelForge Figma Plugin

Figma Variables를 JSON으로 내보내는 경량 플러그인입니다.
**Professional 요금제**에서도 Variables REST API 없이 토큰을 추출할 수 있습니다.

## 설치 방법

1. Figma Desktop App에서 `Plugins > Development > Import plugin from manifest...` 선택
2. 이 폴더의 `manifest.json` 파일 선택
3. 플러그인 목록에서 "PixelForge Token Exporter" 실행

## 사용 방법

1. 플러그인 실행 후 "Export Variables" 버튼 클릭
2. JSON 파일이 클립보드에 복사됩니다
3. PixelForge Diff 페이지에서 "Plugin JSON" 모드 선택
4. 복사된 JSON을 파일로 저장하거나 직접 업로드

## 출력 형식

```json
{
  "format": "pixelforge",
  "version": 1,
  "exportedAt": "2024-03-20T12:00:00.000Z",
  "tokens": [
    {
      "name": "Colors/Primary",
      "type": "color",
      "value": { "hex": "#2563eb", "rgba": { "r": 37, "g": 99, "b": 235, "a": 1 } },
      "raw": "#2563eb",
      "mode": "Light",
      "collection": "Design Tokens"
    }
  ]
}
```
