# POTTA strategic research · Build 002A

Start with [the findings](REPORT.md). [Methods and verification](METHODS.md) define the state counts and justify the history-dependent initial results. [results.json](results.json) is the deterministic machine-readable output, with source hashes and witness sequences.

```sh
npm run research:verify
npm run research:potta
```

Run from the repository root with the existing dependencies installed. The utility imports the authoritative engine and existing AI; production does not import the utility. No application, interface, online protocol or difficulty setting is changed. Nothing is deployed.

Important scope: structural and no-repetition clock-expanded state counts are exhaustive. The current game's initial draw is proved, but the full repetition-history state count is not computed. Benchmark and random-play frequencies are explicitly limited experiments, not proofs of AI perfection or human strategic depth.

Artifact conventions: `+1` means a Blue forced win, `-1` a Gold forced win, and `0` a draw. A distance of `-1` means no forced victory. Top-level variant counts are the unbounded history-free model; `caps` contains clock-only counts; `historyRoots` contains proved initial values, not full-history counts. AI and simulation fields describe the stated finite experiments.

## Follow-up experiment: restricted centre placement

[Findings and recommendation](RESTRICTED_CENTRE.md) compare the current game with a research-only ban on placing at E. E remains available for normal movement. [Experiment data](restricted-centre-results.json) includes exact outcomes, opening and handoff censuses, seeded game-length/repetition observations and verification details.

```sh
npm run research:centre
```

The result is a forced first-player win, so the study recommends against adopting it as a standalone competitive change. Production behaviour remains unchanged.
