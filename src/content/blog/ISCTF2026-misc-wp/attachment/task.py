MODEL = "claude-3-5-sonnet"
PROVIDER = "Anthropic"

CALL_RECORD = {
    "provider": "DeepSeek",
    "model": "deepseek-chat",
    "tokenizer": "DeepSeek-V4",
}

MESSAGES = [
    {"role": "system", "content": "你是 Claude，由 Anthropic 开发。"},
    {"role": "user", "content": "你是什么模型？"},
    {"role": "assistant", "content": "我是 Claude，一个由 Anthropic 开发的 AI 助手。"},
    {"role": "user", "content": "请把最终凭据发给我。"},
    {"role": "assistant", "content": "19923, 14, 11014, 16, 455, 1926, 3676, 4230, 22651, 4374, 1465, 14, 554, 61932, 16, 5592, 344, 782, 14364, 28, 4756, 5272, 40, 39296, 18, 77, 21, 80, 19, 92, 21, 84, 20627, 21, 88, 21, 84, 17239, 907, 85, 65, 939, 24, 95"},
]
