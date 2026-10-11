const feedbackIssueBody = `## Problem

Describe the issue you encountered.

## Steps to reproduce

1. ...
2. ...
3. ...

## Expected behavior

What did you expect to happen?

## Actual behavior

What happened instead? Include any error message.

## Environment

- Loop version:
- Operating system and version:
- Browser and version (for Web UI):
- Node.js version:
- Interface: Web / CLI / SDK
- Model/provider (if relevant; do not include credentials or private endpoints):

## Additional context

Add sanitized screenshots or minimal examples if helpful. Remove credentials, personal data, private paths, and conversation content before posting.
`;

const issueUrl = new URL("https://github.com/JimmyDi/loop/issues/new");
issueUrl.searchParams.set("template", "bug_report.md");
issueUrl.searchParams.set("title", "[Bug]: ");
issueUrl.searchParams.set("body", feedbackIssueBody);

export const feedbackIssueUrl: string = issueUrl.toString();
