# Help and updates

Open **Settings → Help and updates** to read documentation and release notes.

## Documentation

Documentation opens in a new browser tab and always follows the latest published npm
package. There is one documentation set and no version selector.

## Recent releases

The current package's snapshot and the preceding available stable snapshot appear as
individual buttons. Each opens a modal with date, version and complete notes, readable offline.
Close or Escape returns focus to the selected release without closing Settings. Notes retain
their original release language.

**Full changelog** opens the website's published list in a new browser tab. Website links
require connectivity. Opening Settings does not request release content from the network.

## Release lifecycle

Documentation and notes are generated during release preparation and validated against final
source before publication. The website publishes only npm-confirmed stable versions and
never reads working-tree documentation or Unreleased changelog entries.

See [release documentation](../../../../../docs/releases.md),
[HelpSettings](../components/settings/HelpSettings.tsx), and its colocated test.
