# Workflow demo assets

These manually reviewed static captures show the real Loop frontend chat header,
message timeline, editable message queue, composer and context-compaction states.
The payment-webhook conversation, project, timings, constraints and reported test
outcomes are fictional demo data. No model, tools, backend or regression tests
were executed to produce these scenes. No real conversation or credentials appear.

Nine aligned 1056 × 696 frames are maintained independently for Chinese/English
and native Light/Dark themes: queue, steer, edit, stopped, resumed, manual,
manual-done, auto and auto-done. Each theme was rendered directly with the
product theme. Captures omit scrollbars and image metadata and use lossless WebP.
The surrounding capture background is cropped to the chat window edges consistently
across scenes, languages and themes. The website displays the frames edge to edge
without an additional border or letterboxing and selects themes through native
media-qualified picture sources. Proportional corner clipping removes captured
backing pixels outside the rounded product window.

Recording tools are separate from website tooling and are not part of its
source, dependency graph, development server, CI or production build. Updating
Loop does not regenerate these assets. Review and replace them manually when the
corresponding product interface changes.
