import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { AccountSettings } from "./AccountSettings";
import { i18n } from "../../i18n/setup";
vi.mock("../../state/account-store", () => ({
  useAccount: (select: (state: { user: { id: string; username: string } }) => unknown) =>
    select({ user: { id: "00000000-0000-4000-8000-000000000001", username: "guest" } }),
}));

test("account settings show only the current profile and require its current password", async () => {
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const html = renderToStaticMarkup(<AccountSettings onClose={() => {}} />);
    expect(html).toContain("guest");
    expect(html).toContain("Profile ID");
    expect(html).toContain('name="currentPassword"');
    expect(html).toContain("Change password");
    expect(html).not.toContain("Manage accounts");
  } finally {
    await i18n.changeLanguage(language);
  }
});
