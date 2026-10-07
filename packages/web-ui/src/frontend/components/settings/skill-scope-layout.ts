export const fitSkillScopes = (
  available: number,
  widths: number[],
  moreWidth: number,
  selected: number,
  gap: number,
): number[] => {
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  if (total <= available) return widths.map((_, index) => index);
  const visible = [0];
  let used = (widths[0] ?? 0) + moreWidth + gap;
  for (let index = 1; index < widths.length; index++) {
    if (used + widths[index]! + gap > available) break;
    visible.push(index);
    used += widths[index]! + gap;
  }
  if (selected > 0 && selected < widths.length && !visible.includes(selected)) {
    while (visible.length > 1 && used + widths[selected]! + gap > available) {
      used -= widths[visible.pop()!]! + gap;
    }
    if (used + widths[selected]! + gap <= available) visible.push(selected);
  }
  return visible;
};
