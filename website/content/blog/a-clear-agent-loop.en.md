---
title: Reliable agents start with a clear loop
summary: Separate model input, tool execution and history so that every step leaves an inspectable result.
author: Loop
category: engineering
publishedAt: 2026-11-03
draft: false
---
An understandable agent does not need many roles running at once. It needs a loop that can be explained: prepare input, call the model, handle tool requests, and pass their results to the next turn.

This article describes a design approach: make state boundaries explicit so that automation is easier to inspect, stop and resume.

## Start with one complete interaction

A model can answer directly or request a tool. The loop must distinguish those outcomes rather than treat all text as a final answer. A tool call also needs arguments, a result and a pairing between the two. A running indicator cannot replace a recorded result.

Sequential execution makes the visible process agree with the order in history. Add extra scheduling only when concurrency is needed and cancellation, failure and result ordering have already been defined.

## Separate drafts from completed state

Streaming text is a view of work in progress. Durable conversation history should represent completed interactions, rather than a temporary draft at every refresh. Otherwise an interruption can leave an answer that looks complete but never finished.

Tool results also need to be paired with requests. The next input should identify completed and skipped requests rather than hide missing results in implicit state.

## Give stopping a precise meaning

Stopping means more than removing an animation. Model requests, tool execution and waits for human decisions need to end through a shared cancellation signal. Completed results can remain, while unfinished actions must be identified rather than interpreted as successful.

Recovery should use inspectable records. Before continuing, establish which inputs and results are complete, then choose the next action instead of guessing where execution stopped.

## Keep the loop small and clear

Permissions, context compaction, storage and presentation have different lifecycles. Keeping them outside the loop and connecting them through explicit inputs and events reduces the state core scheduling needs to understand.

A small loop is valuable because every transition can answer three questions: what happened, what remains, and what is allowed next.
