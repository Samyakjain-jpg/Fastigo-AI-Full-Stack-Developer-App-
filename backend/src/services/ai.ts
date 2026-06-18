/**
 * AI Summarization Service
 * Generates an executive summary and structured action items from task titles and descriptions.
 * Leverages Gemini API when key is available, falls back to a rules-based NLP template generator.
 */

export async function generateTaskSummary(title: string, description: string): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const taskDesc = description || 'No description provided.';

  if (geminiApiKey) {
    try {
      // Direct call to Gemini API using fetch to avoid needing custom packages
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze the following task and generate a concise summary.
Title: ${title}
Description: ${taskDesc}

Provide:
1. A 2-sentence high-level overview.
2. A bulleted list of 3-5 concrete technical action items.
3. A risk assessment (e.g., dependencies, potential bottlenecks).
Format clearly with Markdown.`
                  }
                ]
              }
            ]
          })
        }
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      }
    } catch (error) {
      console.warn('[AI Service] Gemini API call failed. Falling back to local summarizer.', error);
    }
  }

  // Sophisticated Rule-Based Local Fallback Summarizer
  return generateLocalSummary(title, taskDesc);
}

function generateLocalSummary(title: string, description: string): string {
  // Extract verbs and targets to build action points
  const sentences = description
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const actionItems: string[] = [];
  const technologies: string[] = [];

  // Tech keywords to extract
  const techKeywords = ['React', 'Next.js', 'PostgreSQL', 'Redis', 'Docker', 'API', 'JWT', 'Nginx', 'Socket.io', 'CSS', 'Express', 'TypeScript', 'Node.js', 'Prisma', 'Jest'];
  techKeywords.forEach(tech => {
    const regex = new RegExp(`\\b${tech}\\b`, 'i');
    if (regex.test(title) || regex.test(description)) {
      technologies.push(tech);
    }
  });

  // Basic NLP rules for action items extraction
  sentences.forEach((sentence) => {
    const actionVerbs = ['implement', 'build', 'create', 'setup', 'configure', 'write', 'fix', 'optimize', 'deploy', 'design', 'test', 'integrate', 'add'];
    for (const verb of actionVerbs) {
      const regex = new RegExp(`\\b${verb}\\b\\s+(.*)`, 'i');
      const match = sentence.match(regex);
      if (match && match[0]) {
        let action = match[0].trim();
        action = action.charAt(0).toUpperCase() + action.slice(1);
        if (!actionItems.includes(action) && actionItems.length < 4) {
          actionItems.push(action);
        }
        break;
      }
    }
  });

  // Fallback default action items if description is empty or vague
  if (actionItems.length === 0) {
    actionItems.push(`Analyze requirements for "${title}"`);
    actionItems.push('Design database structure and interface layout');
    actionItems.push('Implement core functionality and write unit tests');
    actionItems.push('Verify end-to-end integration and deploy');
  }

  // Generate Overview
  const techStackString = technologies.length > 0 ? ` using ${technologies.join(', ')}` : '';
  const overview = `This task involves the implementation of **${title}**${techStackString}. The goal is to address the technical and functional details outlined in the project scope.`;

  // Estimate risk
  let riskAssessment = 'Standard implementation complexity. Ensure code quality and test coverage.';
  if (/security|auth|login|password|jwt/i.test(title + ' ' + description)) {
    riskAssessment = 'High security impact. Requires careful handling of credentials, JWT tokens, and CORS policies.';
  } else if (/database|postgres|redis|migration/i.test(title + ' ' + description)) {
    riskAssessment = 'Data persistence impact. Ensure correct transactions and cache invalidation policies.';
  } else if (/real-time|socket|websocket/i.test(title + ' ' + description)) {
    riskAssessment = 'Network performance impact. Keep socket connections lightweight and manage server overhead.';
  }

  return `### AI Task Summary: ${title}

#### Overview
${overview}

#### Key Action Items
${actionItems.map((item) => `- [ ] ${item}`).join('\n')}

#### Tech Stack Identified
${technologies.length > 0 ? technologies.map((t) => `\`${t}\``).join(' ') : '`General`'}

#### Risk & Complexity Assessment
- **Status**: ${riskAssessment}
`;
}
