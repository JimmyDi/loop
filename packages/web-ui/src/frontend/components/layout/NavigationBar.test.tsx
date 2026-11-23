import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { NavigationBar } from "./NavigationBar";

test("Echo is an independent navigation destination", () => {
  const html = renderToStaticMarkup(
    <NavigationBar
      settingsOpen={false}
      echoOpen
      onHome={() => {}}
      onEcho={() => {}}
      onSettings={() => {}}
    />,
  );
  expect(html).toContain('aria-label="Echo"');
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
});

test("navigation exposes Home and the Settings menu with the active view", () => {
  const render = (settingsOpen: boolean) =>
    renderToStaticMarkup(
      <NavigationBar settingsOpen={settingsOpen} onHome={() => {}} onSettings={() => {}} />,
    );
  expect(render(false)).toContain('aria-current="page"');
  expect(render(false)).toContain('aria-label="Home"');
  expect(render(false)).toContain('aria-label="Settings"');
  expect(render(true)).not.toContain('aria-current="page"');
  expect(render(true)).toContain('data-active="true"');
});

test("Home shows an accessible blue-dot marker only when chats are unread", () => {
  const render = (unread: boolean) =>
    renderToStaticMarkup(
      <NavigationBar settingsOpen={true} unread={unread} onHome={() => {}} onSettings={() => {}} />,
    );
  expect(render(true)).toContain("navigation-home-unread");
  expect(render(true)).toContain('aria-label="Unread"');
  expect(render(false)).not.toContain("navigation-home-unread");
});
