import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { PermissionMode } from '@/api/types';
import type { ApprovalPolicy, SandboxMode } from './codexAppServerTypes';
import { logger } from '@/ui/logger';

export interface CodexSettings {
    approvalPolicy?: ApprovalPolicy;
    sandboxMode?: SandboxMode;
}

const APPROVAL_POLICIES: ReadonlySet<string> = new Set([
    'untrusted',
    'on-failure',
    'on-request',
    'never',
]);

const SANDBOX_MODES: ReadonlySet<string> = new Set([
    'read-only',
    'workspace-write',
    'danger-full-access',
]);

function getCodexConfigPath(): string {
    const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
    return join(codexHome, 'config.toml');
}

function parseTopLevelTomlString(content: string, key: string): string | undefined {
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        if (line.startsWith('[')) break;

        const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(['"])(.*?)\2\s*(?:#.*)?$/);
        if (match?.[1] === key) {
            return match[3];
        }
    }

    return undefined;
}

export function readCodexSettings(): CodexSettings | null {
    try {
        const configPath = getCodexConfigPath();
        if (!existsSync(configPath)) {
            logger.debug(`[CodexSettings] No Codex config file found at ${configPath}`);
            return null;
        }

        const content = readFileSync(configPath, 'utf-8');
        const approvalPolicy = parseTopLevelTomlString(content, 'approval_policy');
        const sandboxMode = parseTopLevelTomlString(content, 'sandbox_mode');

        return {
            approvalPolicy: APPROVAL_POLICIES.has(approvalPolicy ?? '') ? approvalPolicy as ApprovalPolicy : undefined,
            sandboxMode: SANDBOX_MODES.has(sandboxMode ?? '') ? sandboxMode as SandboxMode : undefined,
        };
    } catch (error) {
        logger.debug(`[CodexSettings] Error reading Codex config: ${error}`);
        return null;
    }
}

export function resolveCodexDefaultPermissionMode(settings: CodexSettings | null): PermissionMode | null {
    if (!settings) return null;
    if (!settings.approvalPolicy && !settings.sandboxMode) return null;

    const runsWithoutPrompt = settings.approvalPolicy === 'never' || settings.approvalPolicy === 'on-failure';

    if (settings.sandboxMode === 'read-only') {
        return 'read-only';
    }

    if (settings.sandboxMode === 'danger-full-access' && runsWithoutPrompt) {
        return 'yolo';
    }

    if (settings.sandboxMode === 'workspace-write' && runsWithoutPrompt) {
        return 'safe-yolo';
    }

    if (!settings.sandboxMode && runsWithoutPrompt) {
        return 'safe-yolo';
    }

    return 'default';
}

export function getCodexDefaultPermissionMode(): PermissionMode | null {
    return resolveCodexDefaultPermissionMode(readCodexSettings());
}
