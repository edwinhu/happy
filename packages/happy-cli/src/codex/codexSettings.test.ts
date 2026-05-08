import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
    getCodexDefaultPermissionMode,
    readCodexSettings,
    resolveCodexDefaultPermissionMode,
} from './codexSettings';

describe('codexSettings', () => {
    let testCodexHome: string;
    let originalCodexHome: string | undefined;

    beforeEach(() => {
        testCodexHome = join(tmpdir(), `test-codex-${Date.now()}`);
        mkdirSync(testCodexHome, { recursive: true });
        originalCodexHome = process.env.CODEX_HOME;
        process.env.CODEX_HOME = testCodexHome;
    });

    afterEach(() => {
        if (originalCodexHome !== undefined) {
            process.env.CODEX_HOME = originalCodexHome;
        } else {
            delete process.env.CODEX_HOME;
        }
        if (existsSync(testCodexHome)) {
            rmSync(testCodexHome, { recursive: true, force: true });
        }
    });

    it('reads top-level approval and sandbox settings from config.toml', () => {
        writeFileSync(join(testCodexHome, 'config.toml'), [
            'model = "gpt-5.5"',
            'approval_policy = "never"',
            'sandbox_mode = "danger-full-access"',
            '[projects."/tmp/project"]',
            'sandbox_mode = "read-only"',
        ].join('\n'));

        expect(readCodexSettings()).toEqual({
            approvalPolicy: 'never',
            sandboxMode: 'danger-full-access',
        });
    });

    it('maps danger-full-access with no prompts to yolo', () => {
        expect(resolveCodexDefaultPermissionMode({
            approvalPolicy: 'never',
            sandboxMode: 'danger-full-access',
        })).toBe('yolo');
    });

    it('maps workspace auto-run config to safe-yolo', () => {
        expect(resolveCodexDefaultPermissionMode({
            approvalPolicy: 'on-failure',
            sandboxMode: 'workspace-write',
        })).toBe('safe-yolo');
    });

    it('maps read-only sandbox to read-only', () => {
        expect(resolveCodexDefaultPermissionMode({
            approvalPolicy: 'never',
            sandboxMode: 'read-only',
        })).toBe('read-only');
    });

    it('maps explicit prompting config to default instead of falling back elsewhere', () => {
        expect(resolveCodexDefaultPermissionMode({
            approvalPolicy: 'untrusted',
            sandboxMode: 'workspace-write',
        })).toBe('default');
    });

    it('returns null when no permission-related config is present', () => {
        expect(resolveCodexDefaultPermissionMode({})).toBeNull();
    });

    it('returns configured yolo default through getCodexDefaultPermissionMode', () => {
        writeFileSync(join(testCodexHome, 'config.toml'), [
            'approval_policy = "never"',
            'sandbox_mode = "danger-full-access"',
        ].join('\n'));

        expect(getCodexDefaultPermissionMode()).toBe('yolo');
    });
});
