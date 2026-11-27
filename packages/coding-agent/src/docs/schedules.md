# Local scheduled tasks

Open **Automation** below **New task** in the sidebar in Web or Desktop. Use the back arrow beside **Scheduled tasks** to return to the previous chat. In **Scheduled tasks**, choose **Add automation**. Under **Basics**, enter the instructions and choose a repeat pattern. New tasks default to 09:00 daily in the local time zone. For Daily, type a time or choose from 15-minute increments. Choose Interval to enter minutes or hours, including fractional hours, with a minimum duration of one minute. Choose Weekdays for Monday through Friday or Weekly for one weekday. Custom supports every N hours, days, weeks, months or years. Select multiple weekdays, month days or months where applicable. Missing calendar dates are skipped. Advanced users can enter a single RFC 5545 recurrence rule with hourly through yearly frequency. The time zone selector shows each region and its current UTC offset. Under **Advanced**, choose an accessible project, give the task a name, or change permissions and missed-run handling. A blank name uses the first line of the instructions. **Next runs** automatically lists up to three upcoming times in your local time zone as you edit the schedule. An ellipsis below the list indicates more runs are scheduled. Choose **Save** in the top bar to return to the task list. The **Automation** breadcrumb and **Cancel** return to the list without saving edits. Each task row starts with a status icon. Queued and running executions take precedence over the schedule status. The Tasks list restores the schedule status when a run ends. Select a task row to edit it. The editor toolbar can run the saved configuration immediately or delete the task. Hover or focus a row to test it, or open its menu to pause, resume or delete it. Clicking Run in the list or editor immediately shows the task name in its project’s session list. The pending row uses the chat spinner. When the chat becomes available, open it directly from the sidebar. Running and unread chats use the standard spinner and blue dot. Starting a run keeps the current Automation view open. **Run history** refreshes when a schedule or run is saved. Tasks and Run history also refresh every ten seconds while visible as a fallback. Choose **Open chat** once the session is available. On touch screens the actions stay visible. Each run opens an independent project chat. Switch to **Run history** to see runs from all schedules, newest first, including deleted schedules. Open a run’s chat to review results, answer questions or respond to approval requests.

## Local host and CLI

Keep Desktop or the Web backend running and the computer awake. Closing the browser tab leaves the Web backend running. To start a foreground host and manage it from another terminal:

```bash
loop web --no-open
```

```bash
loop schedules projects
loop schedules list
loop schedules --help
```

The CLI connects to the local Web port (default 3080, override with `--port PORT` immediately after `schedules`). Use the Desktop Automation page for the authenticated Desktop backend. To create a plan using the CLI, put the following JSON in `schedule.json` and replace the project ID with one from the project list:

```json
{
  "name": "Weekday project review",
  "projectId": "PROJECT_ID",
  "prompt": "Summarize the project's open TODOs.",
  "permission": "read-only",
  "missed": "run-once",
  "trigger": { "kind": "cron", "expression": "0 9 * * 1-5", "timezone": "Asia/Shanghai" }
}
```

```bash
loop schedules create schedule.json
loop schedules history SCHEDULE_ID
```

Use `edit ID FILE` to replace a plan, `pause` and `resume` to change future scheduling, `run` to request an immediate run, and `cancel` to stop a run. Deleting a plan removes it from the active list. Its chat and history remain accessible. Pausing, editing and deleting cancel queued work and let already-started runs finish.

## Timing and execution

- A recurrence trigger uses kind `rrule`, a single `rule` string, an IANA `timezone`, and an `anchorAt` Unix timestamp in milliseconds. The anchor sets the local starting period and is retained on edit.
- Once accepts a future Unix timestamp in milliseconds, `at`. Interval uses `anchorAt` and `everyMs`, with a one-minute minimum. Cron uses five numeric fields and an IANA time zone.
- A single timer wakes at the next due time, recalibrating at least once per minute. The index stays in memory. Each service has one background execution slot. It defers while a project has busy sessions in that host. Independent interactive CLI processes and other Web hosts maintain their own sessions.
- Missed recurring times coalesce to the latest one. A time at least one minute late follows the selected policy. `run-once` executes the latest occurrence, `skip` records a skipped run and one-shot `ask` leaves it for manual review. The next interval remains anchored to its original start.
- Each run snapshots its prompt and permission preset. New Web tasks default to **Read only**. To allow unattended MCP calls, explicitly choose **Full access** under **Advanced → Permissions**. It uses the same host access as a Full access chat, including unsandboxed shell commands and MCP calls without approval. Use the same `danger-full-access` value when creating a task via the CLI or SDK. Restricted presets require an interactive chat connection to receive new approval requests. A run has a 30-minute deadline including interaction waits.

## Persistence, recovery and limits

Files in `schedules/<id>/` under the Loop data directory hold the plan and individual run records. The scheduler writes a temporary file and renames it on the same filesystem. An atomic plan update records both the intended run and the advanced schedule before any model dispatch. Startup materializes queued intent and marks abandoned running work interrupted. The session ID is saved before calling the prompt. Open its history to inspect partial work. A history save failure triggers a flush attempt; persistent failures appear as save-pending. Runtime shutdown stops and drains active work.

One loopback socket per local data directory guards ownership. The OS releases it when the process exits. Web and Desktop hosts using the same data directory forward local Automation requests to the owner over an authenticated loopback connection. Only the owner dispatches runs. Other local hosts observe committed session metadata. They refresh the project session list as scheduled chats become available. The project sidebar uses the scheduler host’s live state to show the spinner during generation. Opening an active scheduled chat streams live messages from the scheduler host over the authenticated loopback connection. When the run ends the viewer reconnects to saved history. If the owner exits, another host can take over on the next management request or within a minute. An older host or an SDK host without a management endpoint must release ownership before another host can manage schedules. A conflicting local port also blocks ownership. Use local storage on one computer. Process-crash recovery does not guarantee durability across power loss. The scheduler maintains a local JSON Lines index at `schedules/runs.jsonl`. Each line contains the latest metadata for one run. Its input fields contain only the task name and project ID. The individual run files retain the full input. Global history is served from the in-memory copy, including runs from deleted tasks. The owner rebuilds the index from the individual run files on startup after recovery, which also imports existing history and repairs a missing or incomplete index. The index merges updates over 250 ms, then replaces the JSONL file atomically. Shutdown flushes pending index changes. Run history groups records by local date and automatically loads the next 50 as you approach the bottom. **Load older runs** can also load the next page, including after a fetch failure. The interface renders rows near the viewport. Status icons beside each run time show completion, active generation, or failure. Select a row to open its chat. Finished runs can be archived, restored or permanently deleted from the history list. The corresponding chat remains available. A deleted run leaves a marker containing no run metadata to prevent replay. The paginated Web endpoint is `GET /api/schedules/runs/page` with optional `limit` (1–100) and `after` (the returned cursor’s scheduledFor, scheduleId and id joined by slashes). The existing unpaginated endpoint remains available. While a manual run is pending in the sidebar, the client checks its individual record until the chat is listed or the run ends without a chat. Storage errors that stop scheduling are shown in the management view; repair storage and restart the backend.

## SDK

The public SDK exports `ScheduleService`, `ScheduleInput`, `ScheduleRun`, `ScheduleHost` and `nextOccurrence`. Construct the service with an agent data directory and a host implementing `available(projectId)` and `execute(run, attach, signal)`. The optional host callback `onOwner()` starts owner-only resources and returns their asynchronous cleanup. The host creates a managed session using the run's permission, awaits `attach(sessionId)` before prompting, and observes cancellation. Call `start()`, check `owner` and use `historyPage(limit, after?)` for metadata pages, or `put(input, id?)`, `list()`, `history(id)` and `change(id, action, requestId?)`. Reuse the same UUID when retrying a manual run request. Use `findRun(scheduleId, runId)` to read an individual run or get `undefined` if it does not exist. Await `close()` on shutdown. SDK imports alone start no timer or service.

[Scheduler](../core/scheduling/service.ts) · [Recovery tests](../core/scheduling/service.test.ts) · [Session approvals](approvals.md)
