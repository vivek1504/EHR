export function calculateOffsets(
  documentText: string,
  entityText: string,
): {
  start: number;
  end: number;
} | null {
  const escaped = entityText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\s+/g, "\\s+");
  const regex = new RegExp(pattern, "i");
  const match = documentText.match(regex);
  if (match && match.index !== undefined) {
    return {
      start: match.index,
      end: match.index + match[0].length,
    };
  }
  return null;
}
