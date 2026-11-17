function post_process_with_lists(response: string) {
    // Split by double line breaks to separate questions
    let questions = response.split(/\n\n+/);
    let result = [];
    
    for (let question of questions) {
        if (!question.trim()) continue;
        
        // Remove all newlines within this question block
        let singleLine = question.replace(/\n/g, '');
        
        // Now process the list items on this single line
        let inList = false;
        let processed = '';
        
        // Split by <br> tags
        let parts = singleLine.split('<br>');
        
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i].trim();
            
            // Check if this part is a list item
            if (part.match(/^[-*]\s/)) {
                // If not already in a list, open one
                if (!inList) {
                    processed += '<ul style="list-style-type: disc; list-style-position: outside; padding-left: 20px;">';
                    inList = true;
                }
                // Add the list item (remove the - or * prefix)
                processed += '<li>' + part.replace(/^[-*]\s/, '') + '</li>';
            } else {
                // If we were in a list, close it
                if (inList) {
                    processed += '</ul>';
                    inList = false;
                }
                // Add the non-list part
                if (part) {
                    processed += (processed ? '<br>' : '') + part;
                }
            }
        }
        
        // Close list if still open at the end
        if (inList) {
            processed += '</ul>';
        }
        
        result.push(processed);
    }
    
    return result.join('\n');
}

const tests_dict = {
  '$test1$': `
Slide 1: <b>Introduction to the topic and its significance</b><br>* There were three main factors contributing to the issue.<br>* The first factor was economic downturn affecting markets.<br>* The second factor was changes in consumer behavior due to technological advancements.
Slide 2: <b>Overview of the current situation and challenges</b><br>* Market volatility has increased due to geopolitical tensions.<br>* This has led to uncertainty among investors.
        `
}


export function stepSlideLists(response: string): string { 


  // find if response matches a test case
  for (const [key, test] of Object.entries(tests_dict)) {
    if (response.includes(key)) {
      response = test;
      break;
    }
  }

  // First process lists
  let processed = post_process_with_lists(response);

  // Wrap each slide in a styled card.
  // Capture:
  //  - slide number
  //  - title
  //  - content up to (but not including) the next "Slide X:" or end of string
  processed = processed.replace(
    /Slide\s+(\d+):\s*(?:<div[^>]*>\s*)?<b>(.*?)<\/b>\s*([\s\S]*?)(?=\n?\s*Slide\s+\d+:\s*|$)/g,
    (match, slideNum, title, content) => {
      const body = content.trim();

      return `Slide ${slideNum}: <div class="slide-card"><h2 class="slide-title">${title}</h2><div class="slide-content">${body}</div></div>\n`;
    }
  );
  
  console.log('== Processed lists.');
  console.log('Processed response:', JSON.stringify(processed));
  return processed;
}