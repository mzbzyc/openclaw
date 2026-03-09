import { createSubsystemLogger } from "../logging/subsystem.js";
import type { OpenClawConfig } from "../config/config.js";

const log = createSubsystemLogger("normalized-directives");

interface DirectiveTemplate {
  pattern: string;
  description: string;
  parameters: string[];
  examples: string[];
}

interface NormalizedDirective {
  type: string;
  parameters: Record<string, any>;
  template?: string;
}

export interface UserDirectiveConfig {
  type: string;
  pattern: string;
  description: string;
  parameters: string[];
  examples: string[];
}

export class NormalizedDirectives {
  private templates: Record<string, DirectiveTemplate> = {};

  constructor(cfg?: OpenClawConfig) {
    this.initializeTemplates();
    this.loadUserDirectives(cfg);
  }

  /**
   * Initialize directive templates
   */
  private initializeTemplates() {
    // Move file directive
    this.addTemplate(
      "move",
      "move {src} to {dst}",
      "Move file or directory to specified location",
      ["src", "dst"],
      [
        "move file.txt to docs/",
        "move folder/ to backup/"
      ]
    );

    // Reminder directive
    this.addTemplate(
      "reminder",
      "remind me {time} {event}",
      "Remind about specified event at specified time",
      ["time", "event"],
      [
        "remind me 10:00 meeting",
        "remind me tomorrow morning 8:00 wake up"
      ]
    );

    // Format directive
    this.addTemplate(
      "format",
      "format {text} as {format}",
      "Format text to specified format",
      ["text", "format"],
      [
        "format {\"name\": \"John\"} as JSON",
        "format Hello as uppercase"
      ]
    );

    // Find file directive
    this.addTemplate(
      "find",
      "find {pattern}",
      "Find files matching specified pattern",
      ["pattern"],
      [
        "find *.js",
        "find README.md"
      ]
    );

    // List directory directive
    this.addTemplate(
      "list",
      "list {path}",
      "List contents of specified directory",
      ["path"],
      [
        "list .",
        "list docs/"
      ]
    );

    // View file directive
    this.addTemplate(
      "view",
      "view {file}",
      "View contents of specified file",
      ["file"],
      [
        "view package.json",
        "view README.md"
      ]
    );

    // Copy file directive
    this.addTemplate(
      "copy",
      "copy {src} to {dst}",
      "Copy file or directory to specified location",
      ["src", "dst"],
      [
        "copy file.txt to docs/",
        "copy folder/ to backup/"
      ]
    );

    // Delete file directive
    this.addTemplate(
      "delete",
      "delete {file}",
      "Delete specified file or directory",
      ["file"],
      [
        "delete file.txt",
        "delete temp/"
      ]
    );

    // Create directory directive
    this.addTemplate(
      "mkdir",
      "create directory {directory}",
      "Create specified directory",
      ["directory"],
      [
        "create directory docs/",
        "create directory src/utils/"
      ]
    );

    // System status directive
    this.addTemplate(
      "system-status",
      "system status",
      "View system status",
      [],
      ["system status"]
    );

    // Network status directive
    this.addTemplate(
      "network-status",
      "network status",
      "View network status",
      [],
      ["network status"]
    );
  }

  /**
   * Load user-defined directives from configuration
   */
  private loadUserDirectives(cfg?: OpenClawConfig) {
    if (!cfg?.directives?.userDirectives) {
      return;
    }

    const userDirectives = cfg.directives.userDirectives;
    if (Array.isArray(userDirectives)) {
      for (const directive of userDirectives) {
        try {
          this.addTemplate(
            directive.type,
            directive.pattern,
            directive.description,
            directive.parameters || [],
            directive.examples || []
          );
          log.info(`Loaded user directive: ${directive.type}`);
        } catch (error) {
          log.error(`Failed to load user directive ${directive.type}: ${error}`);
        }
      }
    }
  }

  /**
   * Add directive template
   */
  public addTemplate(type: string, pattern: string, description: string, parameters: string[], examples: string[]) {
    this.templates[type] = {
      pattern,
      description,
      parameters,
      examples
    };
  }

  /**
   * Get all directive templates
   */
  public getTemplates() {
    return this.templates;
  }

  /**
   * Get directive template
   */
  public getTemplate(type: string) {
    return this.templates[type];
  }

  /**
   * Normalize directive
   */
  public normalize(text: string): NormalizedDirective | null {
    // Try to match known templates
    for (const [type, template] of Object.entries(this.templates)) {
      const regex = this.buildRegexFromPattern(template.pattern);
      const match = text.match(regex);
      if (match) {
        const parameters: Record<string, any> = {};
        for (let i = 1; i < match.length; i++) {
          if (template.parameters[i - 1]) {
            parameters[template.parameters[i - 1]] = match[i];
          }
        }
        return {
          type,
          parameters,
          template: template.pattern
        };
      }
    }
    return null;
  }

  /**
   * Build regex from pattern
   */
  private buildRegexFromPattern(pattern: string): RegExp {
    // Replace {param} with capture group
    const regexPattern = pattern.replace(/{(\w+)}/g, "(.*)");
    // Escape special characters
    const escapedPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Build regex
    return new RegExp(`^${escapedPattern}$`, "i");
  }

  /**
   * Generate directive examples
   */
  public generateExamples() {
    const examples: string[] = [];
    for (const template of Object.values(this.templates)) {
      examples.push(...template.examples);
    }
    return examples;
  }

  /**
   * Validate directive
   */
  public validate(directive: NormalizedDirective): boolean {
    const template = this.templates[directive.type];
    if (!template) {
      return false;
    }
    // Check if all required parameters exist
    for (const param of template.parameters) {
      if (!(param in directive.parameters)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Format directive
   */
  public format(directive: NormalizedDirective): string {
    const template = this.templates[directive.type];
    if (!template) {
      return JSON.stringify(directive);
    }
    let result = template.pattern;
    for (const [param, value] of Object.entries(directive.parameters)) {
      result = result.replace(`{${param}}`, String(value));
    }
    return result;
  }

  /**
   * Suggest directives
   */
  public suggestDirectives(text: string): string[] {
    const suggestions: string[] = [];
    const lowerText = text.toLowerCase();

    // Provide suggestions based on keywords
    if (lowerText.includes("move")) {
      suggestions.push("move {src} to {dst}");
    }
    if (lowerText.includes("remind")) {
      suggestions.push("remind me {time} {event}");
    }
    if (lowerText.includes("format")) {
      suggestions.push("format {text} as {format}");
    }
    if (lowerText.includes("find")) {
      suggestions.push("find {pattern}");
    }
    if (lowerText.includes("list")) {
      suggestions.push("list {path}");
    }
    if (lowerText.includes("view")) {
      suggestions.push("view {file}");
    }
    if (lowerText.includes("copy")) {
      suggestions.push("copy {src} to {dst}");
    }
    if (lowerText.includes("delete")) {
      suggestions.push("delete {file}");
    }
    if (lowerText.includes("create directory")) {
      suggestions.push("create directory {directory}");
    }
    if (lowerText.includes("system status")) {
      suggestions.push("system status");
    }
    if (lowerText.includes("network status")) {
      suggestions.push("network status");
    }

    return suggestions;
  }
}

// Export singleton instance
export const normalizedDirectives = new NormalizedDirectives();
