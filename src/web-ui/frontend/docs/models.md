# Model Settings

The sidebar's **Model settings** manages one OpenAI Chat Completions-compatible provider. The model menu in the session header selects the model actually used by that session. These are currently separate operations.

## Configure a Custom Service

Open Model settings, fill in the fields, and save. Configuration is available before adding a project.

| Field | Initial value and requirements |
| --- | --- |
| Provider name | Empty; enter a display name |
| Base URL | Empty; enter the API base URL, such as `http://localhost:8080/v1` |
| Model ID | Defaults to gpt-5.5; must be supported by the service |
| Authentication | Defaults to API key; local gateways without authentication can use **No authentication** |
| API key | Password input; saved keys are never filled back in |

Saving validates configuration but does not request a model or test connectivity. Names and URLs have no built-in private configuration. Prefilled values when reopening the dialog come from backend storage.

## Apply to a Session

- New sessions default to the saved custom model.
- Existing sessions retain their own provider/model; saving settings does not switch the current session.
- To apply the configuration to the current session, wait until it is idle and select the `loop-custom` entry in its model menu. History is preserved.
- If the session already uses the same custom model, URL or key changes apply to its next request without restarting.

The model menu reads `/api/models`; catalog membership does not mean credentials are available. Changing the custom model ID requires selecting it again. See [backend providers](../../backend/docs/providers.md) for restoring sessions with an old ID.

## Saving, Errors, and Privacy

useProviderSettings queries public configuration and refreshes the model catalog after saving. Input stays in the form; keys never enter the Query cache or localStorage and are cleared on successful save. Leaving the API key empty omits the field and preserves a saved key for the same URL. Changing the URL requires re-entering the key; choosing no authentication removes the old key.

Save failures preserve input. A running, loading, switching, or pending-save session causes provider_busy; finish the operation before saving. A missing endpoint returning 404 requires restarting to load new backend code. Frontend hot updates do not reload backend routes.

For connection failures, check the session header's current provider/model first, then the configured URL, authentication, and target service. Successfully switching models does not delete historical errors.

There is no management of multiple custom providers, model discovery, OAuth, connection-test button, or combined save-and-switch operation. The backend owns storage and actual model calls; see the [provider contract](../../backend/docs/providers.md).

## Source and Tests

- [ProviderSettingsDialog](../components/settings/ProviderSettingsDialog.tsx) / [tests](../components/settings/ProviderSettingsDialog.test.tsx).
- [ProviderForm](../components/settings/ProviderForm.tsx) / [tests](../components/settings/ProviderForm.test.tsx).
- [useProviderForm](../hooks/useProviderForm.ts) / [tests](../hooks/useProviderForm.test.tsx).
- [useProviderSettings](../hooks/useProviderSettings.ts) / [tests](../hooks/useProviderSettings.test.tsx).
- [ModelSelect](../components/layout/ModelSelect.tsx) / [tests](../components/layout/ModelSelect.test.tsx).
