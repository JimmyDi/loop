export type ChangelogRelease = { version: string; date: string; notes: string };

export const changelogReleases = (markdown: string): ChangelogRelease[] => {
  const sections = [...markdown.matchAll(/^## (.+)\r?$/gm)];
  return sections.flatMap((section, index) => {
    const release = section[1].match(/^\[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/);
    if (!release) return [];
    return [
      {
        version: release[1],
        date: release[2],
        notes: markdown.slice(section.index + section[0].length, sections[index + 1]?.index).trim(),
      },
    ];
  });
};
