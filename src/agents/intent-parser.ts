import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("intent-parser");

interface IntentPattern {
  pattern: RegExp;
  intent: string;
  parameters: string[];
  handler: (params: Record<string, string>) => any;
}

interface IntentMatch {
  intent: string;
  parameters: Record<string, string>;
  confidence: number;
}

export class IntentParser {
  private patterns: IntentPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize intent patterns
   */
  private initializePatterns() {
    // Move file intent
    this.addPattern(
      /move\s+(.*)\s+to\s+(.*)/i,
      "move_file",
      ["source", "destination"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `mv "${params.source}" "${params.destination}"`,
          confirm: true
        }
      })
    );

    // Reminder intent
    this.addPattern(
      /remind me\s+(.*)\s+at\s+(.*)/i,
      "reminder",
      ["event", "time"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `echo "Reminder: ${params.event}" | at ${params.time}`,
          confirm: true
        }
      })
    );

    // Format text intent
    this.addPattern(
      /format\s+(.*)\s+as\s+(.*)/i,
      "format_text",
      ["text", "format"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `echo "${params.text}" | jq -R .`,
          confirm: false
        }
      })
    );

    // Find file intent
    this.addPattern(
      /find\s+(.*)/i,
      "find_file",
      ["pattern"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `find . -name "${params.pattern}"`,
          confirm: false
        }
      })
    );

    // List directory intent
    this.addPattern(
      /list\s+(.*)/i,
      "list_directory",
      ["path"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `ls -la "${params.path}"`,
          confirm: false
        }
      })
    );

    // View file content intent
    this.addPattern(
      /view\s+(.*)/i,
      "view_file",
      ["file"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `cat "${params.file}"`,
          confirm: false
        }
      })
    );

    // Copy file intent
    this.addPattern(
      /copy\s+(.*)\s+to\s+(.*)/i,
      "copy_file",
      ["source", "destination"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `cp "${params.source}" "${params.destination}"`,
          confirm: true
        }
      })
    );

    // Delete file intent
    this.addPattern(
      /delete\s+(.*)/i,
      "delete_file",
      ["file"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `rm "${params.file}"`,
          confirm: true
        }
      })
    );

    // Create directory intent
    this.addPattern(
      /create directory\s+(.*)/i,
      "create_directory",
      ["directory"],
      (params) => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: `mkdir -p "${params.directory}"`,
          confirm: true
        }
      })
    );

    // Check system status intent
    this.addPattern(
      /system status/i,
      "system_status",
      [],
      () => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: "top -b -n 1 | head -20",
          confirm: false
        }
      })
    );

    // Check network status intent
    this.addPattern(
      /network status/i,
      "network_status",
      [],
      () => ({
        type: "function_call",
        name: "exec",
        parameters: {
          command: "ping -c 4 google.com",
          confirm: false
        }
      })
    );
  }

  /**
   * Add intent pattern
   */
  public addPattern(pattern: RegExp, intent: string, parameters: string[], handler: (params: Record<string, string>) => any) {
    this.patterns.push({ pattern, intent, parameters, handler });
  }

  /**
   * Parse intent
   */
  public parse(text: string): IntentMatch | null {
    for (const pattern of this.patterns) {
      const match = text.match(pattern.pattern);
      if (match) {
        const parameters: Record<string, string> = {};
        for (let i = 1; i < match.length; i++) {
          if (pattern.parameters[i - 1]) {
            parameters[pattern.parameters[i - 1]] = match[i];
          }
        }
        return {
          intent: pattern.intent,
          parameters,
          confidence: 1.0
        };
      }
    }
    return null;
  }

  /**
   * Handle intent
   */
  public handleIntent(text: string) {
    const match = this.parse(text);
    if (match) {
      log.info(`Intent matched: ${match.intent} with parameters: ${JSON.stringify(match.parameters)}`);
      const pattern = this.patterns.find(p => p.intent === match.intent);
      if (pattern) {
        return pattern.handler(match.parameters);
      }
    }
    return null;
  }

  /**
   * Check command ambiguity
   */
  public checkAmbiguity(text: string): { ambiguous: boolean; suggestions: string[] } {
    const lowerText = text.toLowerCase();
    const suggestions: string[] = [];

    // Check common ambiguous commands
    if (lowerText.includes("move") && !lowerText.includes("to")) {
      suggestions.push("Did you mean 'move A to B'? This will be processed faster.");
    }

    if (lowerText.includes("remind") && !lowerText.includes("at")) {
      suggestions.push("Did you mean 'remind me [event] at [time]'? This will be processed faster.");
    }

    if (lowerText.includes("format") && !lowerText.includes("as")) {
      suggestions.push("Did you mean 'format [text] as [format]'? This will be processed faster.");
    }

    if (lowerText.includes("copy") && !lowerText.includes("to")) {
      suggestions.push("Did you mean 'copy A to B'? This will be processed faster.");
    }

    if (lowerText.includes("delete") && !lowerText.includes("file") && !lowerText.includes("directory")) {
      suggestions.push("Did you mean 'delete [file]'? This will be processed faster.");
    }

    if (lowerText.includes("create") && !lowerText.includes("directory") && !lowerText.includes("file")) {
      suggestions.push("Did you mean 'create directory [path]'? This will be processed faster.");
    }

    if (lowerText.includes("view") && !lowerText.includes("file") && !lowerText.includes("content")) {
      suggestions.push("Did you mean 'view [file]'? This will be processed faster.");
    }

    if (lowerText.includes("list") && !lowerText.includes("directory")) {
      suggestions.push("Did you mean 'list [directory]'? This will be processed faster.");
    }

    if (lowerText.includes("find") && !lowerText.includes("file") && !lowerText.includes("content")) {
      suggestions.push("Did you mean 'find [pattern]'? This will be processed faster.");
    }

    return {
      ambiguous: suggestions.length > 0,
      suggestions
    };
  }

  /**
   * Get intent confidence
   */
  public getIntentConfidence(text: string): number {
    const match = this.parse(text);
    if (match) {
      return match.confidence;
    }
    
    // More complex confidence evaluation
    const lowerText = text.toLowerCase();
    
    // Intent keywords
    const intentKeywords = [
      "move", "copy", "delete", "create", "view", "list", "find",
      "remind", "format", "system status", "network status"
    ];
    
    // Complexity factors
    const complexityFactors = {
      "code": 0.8,
      "programming": 0.8,
      "analysis": 0.7,
      "complex": 0.7,
      "research": 0.6,
      "design": 0.6,
      "optimization": 0.6,
      "refactoring": 0.6
    };
    
    let keywordCount = 0;
    for (const keyword of intentKeywords) {
      if (lowerText.includes(keyword)) {
        keywordCount++;
      }
    }
    
    let complexityScore = 0;
    for (const [factor, score] of Object.entries(complexityFactors)) {
      if (lowerText.includes(factor)) {
        complexityScore = Math.max(complexityScore, score);
      }
    }
    
    // Base confidence
    const baseConfidence = Math.min(keywordCount / 2, 0.5);
    
    // Combined confidence
    return Math.max(baseConfidence, complexityScore);
  }

  /**
   * Evaluate intent complexity and provide suggestion
   */
  public evaluateIntentComplexity(text: string): { confidence: number; suggestion?: string; shouldUpgrade: boolean } {
    const confidence = this.getIntentConfidence(text);
    
    if (confidence < 0.6) {
      return {
        confidence,
        suggestion: "Your command may need more detailed description, or you may need to use a more powerful model to handle it.",
        shouldUpgrade: true
      };
    }
    
    return {
      confidence,
      shouldUpgrade: false
    };
  }
}

// Export singleton instance
export const intentParser = new IntentParser();
