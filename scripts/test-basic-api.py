"""
기본 API 연결 테스트 (Advisor Tool 없이)
"""
import anthropic
import os

api_key = os.environ.get("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=api_key)

print("=== 기본 API 테스트 ===")
try:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=100,
        messages=[{"role": "user", "content": "안녕? 한 줄로 답해줘."}],
    )
    print("성공:", response.content[0].text)
    print(f"Usage: input={response.usage.input_tokens}, output={response.usage.output_tokens}")
except anthropic.RateLimitError as e:
    print(f"Rate Limit: {e}")
    print("→ 요금제 한도 초과 또는 크레딧 부족")
except anthropic.AuthenticationError as e:
    print(f"인증 오류: {e}")
except Exception as e:
    print(f"{type(e).__name__}: {e}")
