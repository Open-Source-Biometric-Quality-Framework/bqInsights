export type CategoriesResult = { categories: Record<string, string[]> };

export function stepWrapSingle(heading: string, input: string): CategoriesResult {
  // if the input starts with a "Subject: " line, use it as the heading
  const subjectMatch = input.match(/Subject:\s*(.+)$/m);
  
  
  if (subjectMatch) {
    heading = subjectMatch[1].trim();
  }
  // remove re: or fw: from the start of the heading
  heading = heading.replace(/^(Re:|FW:)\s*/i, '').trim();
  // remove any html from the heading
  heading = heading.replace(/<[^>]+>/g, '').trim();
  return { categories: { [heading]: [String(input ?? '')] } };
}
