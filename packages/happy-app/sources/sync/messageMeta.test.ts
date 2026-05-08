import { describe, expect, it } from 'vitest';
import { resolveMessageModeMeta } from './messageMeta';

describe('resolveMessageModeMeta', () => {
    it('sends explicit permission and model keys', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'read-only',
            modelMode: 'gpt-5-high',
            metadata: null,
        } as any);

        expect(meta).toEqual({
            permissionMode: 'read-only',
            permissionModeExplicit: true,
            model: 'gpt-5-high',
            effort: null,
        });
    });

    it('forces bypass permissions in sandbox when mode is default', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'default',
            modelMode: null,
            metadata: {
                sandbox: { enabled: true },
            },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'bypassPermissions',
            permissionModeExplicit: true,
            model: null,
            effort: null,
        });
    });

    it('keeps default permissions when sandbox is disabled', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: 'default',
            metadata: {
                sandbox: null,
            },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'default',
            permissionModeExplicit: true,
            model: null,
            effort: null,
        });
    });

    it('sends default as-is when session permissionMode is default (seeding from initialPermissionMode happens in resolveSessionPermissionMode, not here)', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'default',
            modelMode: null,
            metadata: {
                sandbox: null,
                initialPermissionMode: 'acceptEdits',
            },
        } as any);

        // resolveSessionPermissionMode seeds session.permissionMode = 'acceptEdits' before this is
        // called in practice. If permissionMode is still 'default' here, it means the user explicitly
        // chose 'default', so we must honor it — not fall back to initialPermissionMode again.
        expect(meta.permissionMode).toBe('default');
    });

    it('sends bypassPermissions when session permissionMode is bypassPermissions (seeded from --yolo initialPermissionMode)', () => {
        // resolveSessionPermissionMode seeds session.permissionMode = 'bypassPermissions'
        // from metadata.initialPermissionMode before this is called. So we receive the
        // already-resolved mode and forward it.
        const meta = resolveMessageModeMeta({
            permissionMode: 'bypassPermissions',
            modelMode: null,
            metadata: {
                sandbox: null,
                initialPermissionMode: 'bypassPermissions',
            },
        } as any);

        expect(meta.permissionMode).toBe('bypassPermissions');
    });

    it('falls back to dangerouslySkipPermissions for legacy sessions without initialPermissionMode', () => {
        // Legacy sessions: resolveSessionPermissionMode seeds 'bypassPermissions' from
        // dangerouslySkipPermissions flag, so session.permissionMode arrives as 'bypassPermissions'.
        const meta = resolveMessageModeMeta({
            permissionMode: 'bypassPermissions',
            modelMode: null,
            metadata: {
                sandbox: null,
                dangerouslySkipPermissions: true,
            },
        } as any);

        expect(meta.permissionMode).toBe('bypassPermissions');
    });

    it('ignores unknown initialPermissionMode values (forward-compat)', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'default',
            modelMode: null,
            metadata: {
                sandbox: null,
                initialPermissionMode: 'someFutureMode',
            },
        } as any);

        expect(meta.permissionMode).toBe('default');
    });

    it('respects explicit non-default user choice over initialPermissionMode', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'plan',
            modelMode: null,
            metadata: {
                sandbox: null,
                initialPermissionMode: 'bypassPermissions',
            },
        } as any);

        expect(meta.permissionMode).toBe('plan');
    });

    it('sandbox overrides initialPermissionMode', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'default',
            modelMode: null,
            metadata: {
                sandbox: { enabled: true },
                initialPermissionMode: 'acceptEdits',
            },
        } as any);

        expect(meta.permissionMode).toBe('bypassPermissions');
    });

    // CLI→remote handoff: user explicitly selects 'default' in the remote UI to
    // lower permissions from the CLI's initial bypassPermissions mode.
    // resolveMessageModeMeta must respect the explicit null-like signal and send 'default'
    // rather than falling back to initialPermissionMode — otherwise the user is locked
    // into the CLI's initial mode and cannot reduce permissions from the remote client.
    it('sends default when user explicitly selects default to override a non-default initialPermissionMode', () => {
        // After the user picks 'default' in the UI, updateSessionPermissionMode sets
        // session.permissionMode = 'default'. resolveMessageModeMeta must honor it — not
        // silently override with initialPermissionMode — so the CLI receives the user's intent.
        const meta = resolveMessageModeMeta({
            permissionMode: 'default',
            modelMode: null,
            metadata: {
                sandbox: null,
                initialPermissionMode: 'bypassPermissions',
            },
        } as any);

        expect(meta.permissionMode).toBe('default');
    });
});
