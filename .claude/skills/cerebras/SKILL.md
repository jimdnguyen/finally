---
name: cerebras
description: Use this skill when writing code that calls an LLM through LiteLLM and OpenRouter in this project. This project only allows `openrouter/openrouter/free` (double prefix required — see bug note), with Cerebras set as the preferred inference provider. Covers setup, Structured Outputs, and streaming logic for both standard-model and reasoning-model behaviors.
---

# LiteLLM via OpenRouter

Use LiteLLM for all LLM calls in this repo.

This project only allows one model configuration:

```python
MODEL = "openrouter/openrouter/free"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
```

**Bug:** Use `openrouter/openrouter/free`, NOT `openrouter/free`. LiteLLM strips the
provider prefix before routing, turning `openrouter/free` into bare `free` and causing
a 502 error. The double prefix survives stripping and resolves correctly.
See: https://github.com/BerriAI/litellm/issues/21252

Do not switch to a different OpenRouter model in this project unless the user explicitly changes that requirement.

## Setup

The `OPENROUTER_API_KEY` must be set in `.env` and loaded into the environment.

The `uv` project must include LiteLLM and Pydantic:

```bash
uv add litellm pydantic
```

Prefer Structured Outputs for backend flows that need to populate legal-document fields.

## Important behavior of `openrouter/openrouter/free`

Even though the configured model string is always `openrouter/openrouter/free`, OpenRouter can still route requests to two kinds of underlying models:

- standard models that stream answer text in `delta.content`
- reasoning models that stream `delta.reasoning` first and only later emit `delta.content`

Treat this as one allowed model with two possible response behaviors.

## Build call kwargs once

Use one shared kwargs object so provider settings are always included.

```python
from litellm import completion

call_kwargs = {
    "model": "openrouter/openrouter/free",
    "messages": messages,
    "extra_body": {"provider": {"order": ["cerebras"]}},
}
```

Do not assume provider-specific knobs such as `reasoning_effort` are always supported by whichever free model OpenRouter picks.

## Text response

```python
response = completion(**call_kwargs)
result = response.choices[0].message.content or ""
```

## Structured Outputs

Prefer non-streaming Structured Outputs for field extraction and document population.

```python
from pydantic import BaseModel


class MyBaseModelSubclass(BaseModel):
    ...


response = completion(
    **call_kwargs,
    response_format=MyBaseModelSubclass,
)

result = response.choices[0].message.content or ""
result_as_object = MyBaseModelSubclass.model_validate_json(result)
```

Validate the JSON before using it to populate legal fields.

## Streaming

If you stream chat output from `openrouter/openrouter/free`, handle both token types:

- accumulate `delta.reasoning` separately from visible answer text
- accumulate `delta.content` as the user-visible answer
- keep the loading or typing indicator visible while only reasoning tokens are arriving
- do not display reasoning tokens by default
- set loading to false when real content arrives or when the stream ends

Use a loop shaped like this:

```python
reasoning_accumulated = ""
content_accumulated = ""

for chunk in stream:
    delta = chunk.choices[0].delta
    content = getattr(delta, "content", None)
    reasoning = getattr(delta, "reasoning", None)

    if content:
        content_accumulated += content
        # update the visible assistant message here
        # mark loading false once real content starts
    elif reasoning:
        reasoning_accumulated += reasoning
        # keep loading true so the UI still shows progress

# after the loop, always clear loading so the UI never gets stuck
```

Some SDK responses are dict-like instead of attribute-like. Adjust the field access if needed, but preserve the same branching behavior.

## Default guidance for this project

- Always use `openrouter/openrouter/free` (double prefix — see bug note above).
- Always prefer Cerebras via `extra_body`.
- Use Structured Outputs for legal-data extraction and document field population.
- When streaming, support both reasoning-first and content-first responses.
