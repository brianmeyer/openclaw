# Routing Model Training Data Quality Report

**Status:** ⚠️ Requires Improvement
**Review Date:** February 3, 2026
**Reviewer:** Molly (Subagent)

## Executive Summary
The current data generation strategy in `routing_model_design/data_gen.py` relies on a high-level LLM prompt with minimal few-shot examples. While this is efficient for bootstrapping, the risk of "model collapse" (low diversity, repetitive structures, and lack of edge cases) is high. The current 550 examples per class are likely to be too homogeneous for robust real-world performance, especially in the `voice` and `slow_complex` categories.

---

## 1. Diversity of Examples
**Finding:** 🔴 **Low**
- The LLM prompt is very general: "Generate 500 synthetic user queries... Format the output as a JSON object."
- LLMs without specific "persona" or "scenario" guidance tend to produce structurally similar sentences (e.g., "Explain [Topic]", "Write a [Type] of [Subject]").
- **Risk:** The model will overfit to specific sentence structures rather than the underlying intent.

## 2. Edge Case Coverage (Ambiguity & Mixed Intent)
**Finding:** 🔴 **Poor**
- The prompt does not explicitly request ambiguous or "boundary" queries.
- **Missing Edge Cases:**
    - **Short Complex:** "Define 'self' in Python." (Short like `fast_simple`, but needs `slow_complex` reasoning).
    - **Long Simple:** "Hey, can you please go ahead and check the weather in New York City for me right now?" (Long like `slow_complex`, but intent is `fast_simple`).
    - **Mixed Intent:** "Stop the music and write a poem about rain." (Action + Creative).

## 3. Language/Style Variety
**Finding:** 🟡 **Moderate**
- The `voice` examples in the script show some variety (slang like "Yo", "Hey buddy"), but lack the "messiness" of real speech.
- **Missing Styles:**
    - Non-native speaker syntax.
    - Extreme brevity ("Weather NY").
    - Overly polite vs. rude tones.
    - Domain-specific jargon (e.g., specific coding libraries vs. general questions).

## 4. Voice Realism (Disfluencies & Interruptions)
**Finding:** 🟡 **Low**
- Current examples use "uh", "um", and "like" as tokens, but real disfluencies include:
    - **False Starts:** "Can you... wait, no, tell me the time."
    - **Self-Correction:** "Set a timer for 10, I mean 5 minutes."
    - **Filler Phrases:** "I was wondering if you could maybe..."
- The current set treats "voice" as "slang + fillers" rather than "speech-to-text artifacts."

## 5. Duplicate Detection
**Finding:** 🔴 **High Risk**
- Without a temperature setting or iterative "uniqueness" checking in the script, LLMs generating 500 items in one go often repeat themselves or provide near-duplicates (e.g., "Tell me a joke" vs "Can you tell me a joke").

---

## Recommendations for Improvement

### 1. Stratified Prompting (Diversity)
Instead of one large prompt, split the 500 examples into sub-categories with specific instructions:
- **Fast Simple:** (100) Commands, (100) Factual, (100) Greetings, (100) Settings, (100) Status.
- **Slow Complex:** (100) Code, (100) Creative Writing, (100) Multi-step Math, (100) Philosophical, (100) Summarization.

### 2. Introduce "Adversarial" Examples
Add a specific instruction to generate queries that "look like class A but belong to class B":
- *Example:* "Tell me the entire history of the Roman Empire in one sentence." (Short like Simple, but needs Complex retrieval/summarization).

### 3. Realistic Voice Simulation
Update the `voice` prompt to include:
- **Speech-to-Text Errors:** Homophones (e.g., "write" vs "right").
- **Mid-sentence corrections:** "Hey what's the weather in... actually make that San Francisco."
- **Ambient Noise artifacts:** Partial sentences or cut-offs.

### 4. Technical Guardrails in `data_gen.py`
Modify the script to:
- Use a `set()` to automatically filter exact duplicates.
- Implement a semantic similarity check (e.g., using a fast embedding model) to prune near-duplicates during generation.
- Add a "Persona" list to vary the style (e.g., "Generating 50 examples as a distracted teenager," "Generating 50 examples as a formal professional").

### 5. Data Augmentation
Apply simple augmentations to the synthetic data:
- Synonym replacement.
- Randomly inserting/deleting filler words in the `voice` class.
- Case variation (all caps, all lowercase, mixed).

---
**Log:** [Molly] Proactive: Reviewed routing training data
