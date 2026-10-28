// Keep each synthesis request small without discarding long sentences or Unicode characters.
export const speechSegments = (text: string): string[] => {
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?]?/g) ?? [];
  return sentences.flatMap((sentence) => {
    const chunks: string[] = [];
    let chunk = "";
    for (const character of sentence.trim()) {
      if (chunk.length + character.length > 110) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += character;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
};
