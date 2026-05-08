import { describe, expect, it } from 'vitest';

import { resolveIncomingCodexPermissionMode } from '../permissionMode';

describe('resolveIncomingCodexPermissionMode', () => {
    it('preserves non-default initial mode when old mobile sends default', () => {
        expect(resolveIncomingCodexPermissionMode({
            incoming: 'default',
            currentPermissionMode: 'yolo',
            initialPermissionMode: 'yolo',
        })).toEqual({
            permissionMode: 'yolo',
            shouldUpdateCurrent: false,
            ignored: true,
        });
    });

    it('allows explicit non-default changes', () => {
        expect(resolveIncomingCodexPermissionMode({
            incoming: 'read-only',
            currentPermissionMode: 'yolo',
            initialPermissionMode: 'yolo',
        })).toEqual({
            permissionMode: 'read-only',
            shouldUpdateCurrent: true,
            ignored: false,
        });
    });

    it('allows default when there is no non-default initial mode', () => {
        expect(resolveIncomingCodexPermissionMode({
            incoming: 'default',
            currentPermissionMode: undefined,
            initialPermissionMode: undefined,
        })).toEqual({
            permissionMode: 'default',
            shouldUpdateCurrent: true,
            ignored: false,
        });
    });

    it('honors explicit default even when initial mode is non-default (user downgrade)', () => {
        expect(resolveIncomingCodexPermissionMode({
            incoming: 'default',
            currentPermissionMode: 'yolo',
            initialPermissionMode: 'yolo',
            explicit: true,
        })).toEqual({
            permissionMode: 'default',
            shouldUpdateCurrent: true,
            ignored: false,
        });
    });

    it('ignores invalid modes', () => {
        expect(resolveIncomingCodexPermissionMode({
            incoming: 'invalid-mode',
            currentPermissionMode: 'safe-yolo',
            initialPermissionMode: 'safe-yolo',
        })).toEqual({
            permissionMode: 'safe-yolo',
            shouldUpdateCurrent: false,
            ignored: true,
        });
    });
});
