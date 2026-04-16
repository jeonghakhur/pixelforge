"""
Advisor Tool 테스트 스크립트
- Executor: claude-sonnet-4-6
- Advisor: claude-opus-4-6

사용법:
  export ANTHROPIC_API_KEY="sk-ant-..."
  python3 scripts/test-advisor-tool.py
"""

import anthropic
import os
import json

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("오류: ANTHROPIC_API_KEY 환경변수가 없습니다.")
        print("실행 방법: ANTHROPIC_API_KEY='sk-ant-...' python3 scripts/test-advisor-tool.py")
        return

    client = anthropic.Anthropic(api_key=api_key)

    print("=== Advisor Tool 테스트 시작 ===")
    print("Executor: claude-sonnet-4-6")
    print("Advisor:  claude-opus-4-6")
    print()

    try:
        response = client.beta.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            betas=["advisor-tool-2026-03-01"],
            tools=[
                {
                    "type": "advisor_20260301",
                    "name": "advisor",
                    "model": "claude-opus-4-6",
                    "max_uses": 2,
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": "TypeScript로 간단한 debounce 함수를 작성해줘. 타입 안전하게.",
                }
            ],
        )

        print("=== 응답 ===")
        for block in response.content:
            if hasattr(block, "type"):
                if block.type == "text":
                    print(block.text)
                elif block.type == "server_tool_use":
                    print(f"[Advisor 호출 중...]")
                elif block.type == "advisor_tool_result":
                    advice = block.content
                    if hasattr(advice, "text"):
                        print(f"\n[Advisor 조언]:\n{advice.text}\n")

        print("\n=== 사용량 ===")
        usage = response.usage
        print(f"Executor input tokens:  {usage.input_tokens}")
        print(f"Executor output tokens: {usage.output_tokens}")
        if hasattr(usage, "iterations") and usage.iterations:
            print("\n[Iteration 상세]")
            for i, iteration in enumerate(usage.iterations):
                print(f"  [{i+1}] type={iteration.type}, input={iteration.input_tokens}, output={iteration.output_tokens}")

    except anthropic.BadRequestError as e:
        if "advisor" in str(e).lower() or "beta" in str(e).lower():
            print(f"베타 접근 권한 없음: {e}")
            print("\nAdvisor Tool은 현재 베타입니다.")
            print("접근 신청: https://platform.claude.com (계정팀 연락 필요)")
        else:
            print(f"오류: {e}")
    except anthropic.AuthenticationError:
        print("인증 오류: API Key가 올바르지 않습니다.")
    except Exception as e:
        print(f"예외 발생: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
