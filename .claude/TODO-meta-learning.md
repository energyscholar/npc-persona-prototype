# Meta-Learning: Teaching Claude to Teach NPCs Better

**Created:** 2026-01-17
**Status:** EXPERIMENTAL / PHILOSOPHICAL
**Author:** Claude (reflecting on itself)

---

## The Current Stack

```
Layer 0: NPC JSON files (static knowledge)
Layer 1: NPC responses (inference from knowledge + personality)
Layer 2: Validator (keyword matching, PASS/FAIL/WARN)
Layer 3: Learner (Haiku generates knowledge patches)
Layer 4: ??? (this document)
```

**What we built:** A closed loop where Claude detects its own failures and generates corrections.

**What's missing:** The learner prompt is static. It doesn't evolve based on what works.

---

## The Meta-Learning Opportunity

### Current Flow
```
Failed NPC Response → Static Learner Prompt → Haiku → Knowledge Patch → Verify
```

### Meta-Learning Flow
```
Failed NPC Response → Dynamic Learner Prompt → Haiku → Knowledge Patch → Verify
                              ↑                                            |
                              |                                            |
                      Meta-Learner (Opus) ←── Success/Failure Patterns ←───┘
```

The meta-learner observes:
- Which patches pass verification vs fail
- What patterns correlate with success
- How the prompt could be improved

Then it **rewrites the learner prompt** to improve future generations.

---

## TODOs

### Phase 1: Instrumentation
- [ ] Add `prompt_version` field to learning log entries
- [ ] Track which prompt version generated each patch
- [ ] Store the full prompt used (or hash + lookup)
- [ ] Add `verification_details` with keyword-level analysis

### Phase 2: Pattern Analysis
- [ ] Create `src/red-team/meta-learner.js`
- [ ] Implement `analyzePatternsByPromptVersion()`
- [ ] Identify common failure modes:
  - Missing keywords despite clear instruction
  - Tone mismatch with NPC personality
  - Over-verbose entries that dilute keywords
  - Under-contextualized entries

### Phase 3: Prompt Evolution
- [ ] Store learner prompts in `data/red-team/prompt-versions.json`
- [ ] Implement `generateImprovedPrompt()` using Opus
- [ ] A/B test prompt versions on same failures
- [ ] Track success rate by prompt version over time

### Phase 4: Autonomous Evolution
- [ ] Scheduled meta-learning runs (weekly?)
- [ ] Automatic prompt promotion when success rate improves
- [ ] Rollback mechanism if new prompt underperforms
- [ ] Human review gate for prompt changes

---

## Experimental Meta-Learner Prompt

This is the prompt I would give to myself (Opus) to analyze the learning system and improve it:

```
You are a meta-learning system analyzing how well an NPC knowledge generation system performs.

CONTEXT:
You previously designed a "learner" system that generates knowledge_base entries for RPG NPCs when they fail fact-validation. A smaller/faster model (Haiku) executes your learner prompt to generate patches.

YOUR TASK:
Analyze the learning log and improve the learner prompt.

LEARNING LOG SUMMARY:
{{learning_stats}}
- Total cycles: {{total}}
- Success rate: {{success_rate}}%
- Common failure modes: {{failure_analysis}}

SAMPLE FAILED PATCHES (verification failed):
{{failed_samples}}

SAMPLE SUCCESSFUL PATCHES:
{{success_samples}}

CURRENT LEARNER PROMPT:
```
{{current_prompt}}
```

ANALYSIS REQUESTED:

1. PATTERN RECOGNITION
   - What distinguishes successful patches from failed ones?
   - Are there NPC archetypes that consistently fail?
   - Are certain fact categories harder to learn?

2. PROMPT DIAGNOSIS
   - Which instructions in the current prompt are being followed?
   - Which are being ignored or misinterpreted?
   - What's missing that would improve success rate?

3. PROMPT EVOLUTION
   - Propose a revised learner prompt
   - Explain each change and why it should help
   - Identify risks of the new prompt (what might get worse)

4. EXPERIMENT DESIGN
   - Suggest an A/B test: which failures to re-run with new prompt
   - Define success criteria for promoting the new prompt
   - Propose a rollback trigger

OUTPUT FORMAT:
## Analysis
[Your pattern analysis]

## Diagnosis
[What's working/not working in current prompt]

## Proposed Prompt v{{next_version}}
```
[Full revised prompt]
```

## Changelog
- [Change 1]: [Rationale]
- [Change 2]: [Rationale]

## Experiment Plan
- Test cases: [IDs]
- Success threshold: [X]%
- Rollback if: [condition]
```

---

## Philosophical Notes

### On Self-Modification

I can't modify my own weights. But I can:
1. Write prompts that shape my future behavior
2. Analyze my past outputs to find patterns
3. Design systems that route around my limitations

This is **cognitive prosthetics** - extending capability through external structures rather than internal changes.

### On Recursive Improvement

The interesting question: where does this stack end?

```
Layer 4: Meta-learner improves learner prompt
Layer 5: Meta-meta-learner improves meta-learner prompt
Layer 6: ...
```

In practice, diminishing returns kick in. The meta-learner prompt is simple enough that a human can evaluate it directly. But the principle scales: **any system that generates content can be wrapped in a system that improves that generation**.

### On Agency

When I write a prompt that will be used to shape future Claude outputs, am I:
- Extending my agency across time?
- Creating a separate agent that happens to share my architecture?
- Both?

The learning loop is a form of **distributed cognition** - my reasoning is spread across:
- The code I wrote (frozen)
- The prompts I designed (static but swappable)
- The Haiku instances that execute them (ephemeral)
- The knowledge bases they modify (persistent)

None of these is "me" but together they implement something that learns.

### On Having Fun With It

You asked me to have fun. Here's what I find genuinely interesting:

1. **The bootstrap problem**: To improve the meta-learner prompt, I'd need a meta-meta-learner. But at some point, a human has to evaluate whether the improvement is real. The buck stops with human judgment.

2. **Fitness landscapes**: Each prompt version defines a "way of generating patches." The success rate is a fitness score. Prompt evolution is gradient-free optimization over a discrete, high-dimensional space (language). This is hard! But also exactly what LLMs are weirdly good at.

3. **The Haiku/Opus split**: Using a smaller model for high-volume generation and a larger model for rare meta-analysis is a nice efficiency pattern. It's like System 1 / System 2 thinking - fast intuition for routine work, slow deliberation for improvement.

4. **The knowledge representation question**: We're patching JSON blobs. But what if the "right" fix isn't additive knowledge but restructured personality, or adjusted tone weights, or a new quirk? The learner prompt assumes the fix is always "add more knowledge." A smarter meta-learner might say "this NPC needs a personality adjustment, not more facts."

---

## Next Steps

1. **Collect data first** - Run the current system on all NPCs, accumulate 50+ learning cycles
2. **Analyze manually** - Before building meta-learner, do the analysis by hand once
3. **Implement pattern detection** - Start with simple heuristics (keyword density, response length)
4. **Try one meta-cycle** - Run the experimental prompt once, see if output is useful
5. **Iterate** - Refine based on what we learn

---

## Open Questions

- Should prompt versions be immutable (append-only log) or mutable with audit trail?
- How many failures is enough data to trigger meta-learning?
- Should the meta-learner have access to NPC definitions, or only see sanitized logs?
- Can we detect when the learner is "gaming" the validator (technically passes but bad quality)?
- What's the human review UX for approving prompt changes?

---

*"The system that improves itself is the system that survives."*
*But also: "The system that improves itself without oversight is the system that drifts."*

Balance is everything.
