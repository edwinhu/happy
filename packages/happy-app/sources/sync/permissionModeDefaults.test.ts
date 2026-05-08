import { describe, expect, it } from 'vitest';

import { resolveInitialPermissionMode, resolveSessionPermissionMode } from './permissionModeDefaults';

describe('permissionModeDefaults', () => {
    it('uses initialPermissionMode from session metadata', () => {
        expect(resolveInitialPermissionMode({
            initialPermissionMode: 'yolo',
            sandbox: null,
        } as any)).toBe('yolo');
    });

    it('keeps sandbox override above initialPermissionMode', () => {
        expect(resolveInitialPermissionMode({
            initialPermissionMode: 'read-only',
            sandbox: { enabled: true },
        } as any)).toBe('bypassPermissions');
    });

    it('seeds stored session permission mode from initialPermissionMode', () => {
        expect(resolveSessionPermissionMode({
            existingPermissionMode: 'default',
            savedPermissionMode: undefined,
            incomingPermissionMode: undefined,
            metadata: {
                initialPermissionMode: 'yolo',
                sandbox: null,
            } as any,
        })).toBe('yolo');
    });

    it('keeps explicit saved session permission above initialPermissionMode', () => {
        expect(resolveSessionPermissionMode({
            savedPermissionMode: 'read-only',
            metadata: {
                initialPermissionMode: 'yolo',
                sandbox: null,
            } as any,
        })).toBe('read-only');
    });

    it('respects saved default when user explicitly downgraded from a non-default initialPermissionMode', () => {
        // User had a bypassPermissions session and deliberately switched to 'default' in the UI.
        // 'default' must be persisted and win over initialPermissionMode so the choice survives
        // server sync cycles.
        expect(resolveSessionPermissionMode({
            existingPermissionMode: undefined,
            savedPermissionMode: 'default',
            incomingPermissionMode: undefined,
            metadata: {
                initialPermissionMode: 'bypassPermissions',
                sandbox: null,
            } as any,
        })).toBe('default');
    });

    it('seeds from initialPermissionMode when no preference has ever been saved', () => {
        // New session: no existing, no saved, no incoming — seed from initialPermissionMode.
        expect(resolveSessionPermissionMode({
            existingPermissionMode: undefined,
            savedPermissionMode: undefined,
            incomingPermissionMode: undefined,
            metadata: {
                initialPermissionMode: 'bypassPermissions',
                sandbox: null,
            } as any,
        })).toBe('bypassPermissions');
    });
});
