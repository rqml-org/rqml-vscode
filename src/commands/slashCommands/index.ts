// REQ-CMD-001: Slash command system entry point

import { CommandRegistry } from './registry';
import { createHelpCommands } from './handlers/help';
import { createSessionCommands } from './handlers/session';
import { createProviderCommands } from './handlers/provider';
import { createQualityCommands } from './handlers/quality';
import { createSyncCommands } from './handlers/sync';
import { createPlanCommands } from './handlers/plan';
import { createCmdCommands } from './handlers/cmd';
import { createDiagnosticsCommands } from './handlers/diagnostics';

/**
 * Create and populate the command registry with all slash commands.
 */
export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // REQ-CMD-004: Help and discovery
  for (const cmd of createHelpCommands(registry)) {
    registry.register(cmd);
  }

  // REQ-CMD-005: Session management
  for (const cmd of createSessionCommands()) {
    registry.register(cmd);
  }

  // REQ-CMD-006: Provider and model management
  for (const cmd of createProviderCommands()) {
    registry.register(cmd);
  }

  // REQ-CMD-007: Quality and health
  for (const cmd of createQualityCommands()) {
    registry.register(cmd);
  }

  // REQ-CMD-008: Sync and traceability
  for (const cmd of createSyncCommands()) {
    registry.register(cmd);
  }

  // REQ-CMD-009: Planning
  for (const cmd of createPlanCommands()) {
    registry.register(cmd);
  }

  // REQ-CMD-010: Coding agent
  for (const cmd of createCmdCommands()) {
    registry.register(cmd);
  }

  // REQ-CMD-011: Diagnostics
  for (const cmd of createDiagnosticsCommands()) {
    registry.register(cmd);
  }

  return registry;
}

export { CommandRegistry } from './registry';
export type { SlashCommand, ParsedCommand, CommandContext, CommandCategory } from './types';
