export type CategoriesResult = { categories: Record<string, string[]> };

const tests_dict = {
  '$test1$': `
  
Category A: Description of issue one. Suggestion for improvement one.

Category B: Description of issue two. Suggestion for improvement two.

Category A: Description of issue three. Suggestion for improvement three.
  
  `
  }

export function stepParseLineFormat(input: string): CategoriesResult {
    for (const [key, test] of Object.entries(tests_dict)) {
      if (input.includes(key)) {
        input = test;
        break;
      }
    }
    const cleaned = input.trim();

      // find if response matches a test case
  
    
    const DEBUG = false;
    if (DEBUG) {
      console.log('=== PARSING RESPONSE ===');
      console.log('Raw text:', cleaned);
      console.log('Text length:', cleaned.length);
    }
    // Check if no issues
    if (/^no\s+issues?\s+found/i.test(cleaned) || cleaned.length < 5) {
      console.log('No issues found');
      return { categories: {} };
    }
    
    // Parse line by line
    const lines = cleaned.split('\n').filter(line => line.trim());
    const categories: Record<string, string[]> = {};
    let unmatchedLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Look for pattern: CATEGORY: Description. Suggestion.
      const match = trimmed.match(/^([^:]+):\s*(.+)$/);
      
      if (match) {
        const category = match[1].trim();
        const content = match[2].trim();
        
        if (!categories[category]) {
          categories[category] = [];
        }
        
        categories[category].push(content);
      } else {
        // Line doesn't match expected format
        unmatchedLines.push(trimmed);
      }
    }
    
    // If we have unmatched lines but no properly formatted ones, 
    // put them in a generic category
    if (Object.keys(categories).length === 0 && unmatchedLines.length > 0) {
      console.log('No formatted lines found, using unmatched content');
      categories['Issues'] = unmatchedLines;
    }
    
    if (unmatchedLines.length > 0) {
      console.log('Unmatched lines:', unmatchedLines);
    }
    
    if (DEBUG) {
      console.log('Parsed categories:', Object.keys(categories));
      console.log('Total issues:', Object.values(categories).flat().length);
    }

    // If still no categories, there might be an error
    if (Object.keys(categories).length === 0) {
      console.error('Failed to parse any issues from response');
      return {
        categories: {
          "Parse Error": [`Could not parse the response. Raw text: ${cleaned.substring(0, 200)}...`]
        }
      };
    }
    
    return { categories };
};