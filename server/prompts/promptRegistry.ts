/**
 * Prompt Registry — Centralized versioned prompt loader
 *
 * Replaces duplicated loadPromptTemplate() methods across services.
 * Each prompt lives in server/prompts/<key>/v<N>.md (or .json).
 * The active version is tracked in registry.json.
 *
 * Usage:
 *   import { promptRegistry } from './prompts/promptRegistry';
 *   const prompt = promptRegistry.getPrompt('analysis-system');
 *   const prompt = promptRegistry.getPrompt('analysis-user', { COMMUNITY_NAME: 'Markland' });
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface RegistryEntry {
  activeVersion: number;
  description: string;
}

interface Registry {
  prompts: Record<string, RegistryEntry>;
}

const PROMPTS_DIR = join(process.cwd(), 'server', 'prompts');
const REGISTRY_PATH = join(PROMPTS_DIR, 'registry.json');

class PromptRegistry {
  private registry: Registry;
  private cache: Map<string, string> = new Map();

  constructor() {
    this.registry = this.loadRegistry();
  }

  private loadRegistry(): Registry {
    try {
      const raw = readFileSync(REGISTRY_PATH, 'utf-8');
      return JSON.parse(raw) as Registry;
    } catch (error) {
      console.error('[PromptRegistry] Failed to load registry.json:', error);
      throw new Error('Failed to load prompt registry');
    }
  }

  /**
   * Get a prompt by key, optionally interpolating {VAR} placeholders.
   */
  getPrompt(key: string, variables?: Record<string, string>): string {
    const entry = this.registry.prompts[key];
    if (!entry) {
      throw new Error(`[PromptRegistry] Unknown prompt key: "${key}"`);
    }

    const version = entry.activeVersion;
    const cacheKey = `${key}:${version}`;

    let content = this.cache.get(cacheKey);
    if (!content) {
      content = this.loadPromptFile(key, version);
      this.cache.set(cacheKey, content);
    }

    if (variables) {
      for (const [varName, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{${varName}\\}`, 'g'), value);
      }
    }

    return content;
  }

  /**
   * Get a JSON prompt (for key→value maps like project-type snippets).
   */
  getPromptJson<T = Record<string, string>>(key: string): T {
    const entry = this.registry.prompts[key];
    if (!entry) {
      throw new Error(`[PromptRegistry] Unknown prompt key: "${key}"`);
    }

    const version = entry.activeVersion;
    const cacheKey = `${key}:${version}:json`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const content = this.loadPromptFile(key, version, '.json');
    this.cache.set(cacheKey, content);
    return JSON.parse(content) as T;
  }

  /**
   * List available versions for a prompt key.
   */
  listVersions(key: string): number[] {
    const dir = join(PROMPTS_DIR, key);
    try {
      const files = readdirSync(dir);
      return files
        .map(f => {
          const match = f.match(/^v(\d+)\./);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * Set the active version for a prompt key. Updates registry.json on disk and clears cache.
   */
  setActiveVersion(key: string, version: number): void {
    const entry = this.registry.prompts[key];
    if (!entry) {
      throw new Error(`[PromptRegistry] Unknown prompt key: "${key}"`);
    }

    const versions = this.listVersions(key);
    if (!versions.includes(version)) {
      throw new Error(`[PromptRegistry] Version ${version} not found for "${key}". Available: ${versions.join(', ')}`);
    }

    entry.activeVersion = version;

    // Write updated registry to disk
    writeFileSync(REGISTRY_PATH, JSON.stringify(this.registry, null, 2) + '\n', 'utf-8');

    // Clear cached entries for this key
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }

    console.log(`[PromptRegistry] Set "${key}" active version to ${version}`);
  }

  /**
   * Re-read registry.json from disk (for manual edits).
   */
  reload(): void {
    this.registry = this.loadRegistry();
    this.cache.clear();
    console.log('[PromptRegistry] Registry reloaded');
  }

  /**
   * Get the active version number for a prompt key.
   */
  getActiveVersion(key: string): number {
    const entry = this.registry.prompts[key];
    if (!entry) {
      throw new Error(`[PromptRegistry] Unknown prompt key: "${key}"`);
    }
    return entry.activeVersion;
  }

  /**
   * Get all registered prompt keys.
   */
  listKeys(): string[] {
    return Object.keys(this.registry.prompts);
  }

  private loadPromptFile(key: string, version: number, ext?: string): string {
    // Auto-detect extension if not specified
    const extensions = ext ? [ext] : ['.md', '.json'];
    for (const extension of extensions) {
      const filePath = join(PROMPTS_DIR, key, `v${version}${extension}`);
      try {
        return readFileSync(filePath, 'utf-8');
      } catch {
        // Try next extension
      }
    }
    throw new Error(`[PromptRegistry] Prompt file not found for "${key}" v${version}`);
  }
}

export const promptRegistry = new PromptRegistry();
