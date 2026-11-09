import { readPreference, setPreferenceUser } from "./preferences";
import { useWorkspace } from "../state/workspace-store";
import { useSessions } from "../state/session-store";
import { useTheme } from "../state/theme-store";
import { i18n } from "../i18n/setup";
import { getInitialLanguage } from "../i18n/language";
import { useRequests } from "../state/request-store";
import { useQueueEdits } from "../state/queue-edit-store";

export const activateAccountPreferences = (userId?: string): void => {
  setPreferenceUser(userId);
  useTheme.getState().setTheme(readPreference("theme", "system"));
  void i18n.changeLanguage(getInitialLanguage());
  useSessions.setState({ views: {} });
  useRequests.setState({ pending: userId ? readPreference("requests", {}) : {}, delivery: {} });
  useQueueEdits.setState({ edits: {} });
  useWorkspace.setState({
    active: userId ? readPreference("activeSession", undefined) : undefined,
    drafts: userId ? readPreference("drafts", {}) : {},
    skills: userId ? readPreference("draftSkills", {}) : {},
    draftProjects: userId ? readPreference("draftProjects", {}) : {},
    expanded: userId ? readPreference("expanded", {}) : {},
    images: {},
    files: {},
    sidebar: false,
  });
};
