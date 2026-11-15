# Output contract (v1)

Return **only** a single JSON object, no prose before or after, matching:

```json
{
  "cluster_id": "<id of the story you chose for the perspective>",
  "perspective": {
    "headline": "string, ≤ 12 words",
    "body": "one paragraph, word count within the configured range",
    "refs": [1, 2]
  },
  "article": null | {
    "cluster_id": "<story id; may differ from the perspective story>",
    "headline": "string",
    "dek": "one-sentence summary of the conclusion",
    "paragraphs": [ { "text": "paragraph", "refs": [1] } ],
    "facts": [ { "statement": "verifiable fact", "refs": [1], "event_date": "YYYY-MM-DD or null" } ],
    "interpretation": ["your analytical claims, clearly yours"],
    "uncertainties": ["what is unknown, conflicting or single-sourced"]
  }
}
```

Rules: `refs` are source numbers from the pack. Every paragraph that states facts needs refs. Write an `article` only if the pack contains a story whose score meets the configured threshold and enough material for real analysis; otherwise set `"article": null`.
