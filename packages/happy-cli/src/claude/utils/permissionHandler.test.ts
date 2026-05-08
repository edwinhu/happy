/**
 * Regression tests for PermissionHandler
 *
 * Bug: --permission-mode bypassPermissions was silently ignored for remote sessions because:
 * 1. PermissionHandler initialized with 'default' mode regardless of CLI args
 * 2. reset() hard-coded 'default', undoing any seeding done before each session restart
 *
 * Fix: seedInitialMode() stores the CLI-supplied mode and reset() restores it.
 */

import { describe, expect, it, vi } from 'vitest';
import { PermissionHandler } from './permissionHandler';

vi.mock('@/lib', () => ({
    logger: {
        debug: vi.fn(),
    },
}));

function makeSessionMock() {
    let agentState: Record<string, any> = { requests: {}, completedRequests: {} };
    return {
        session: {
            api: {
                push: () => ({
                    sendSessionNotification: vi.fn(),
                }),
            },
            client: {
                rpcHandlerManager: {
                    registerHandler: vi.fn(),
                },
                getMetadata: vi.fn(() => ({})),
                sessionId: 'test-session-id',
                updateAgentState: vi.fn((updater: (s: any) => any) => {
                    agentState = updater(agentState);
                }),
            },
        } as any,
        getAgentState: () => agentState,
    };
}

function makeAbortSignal(): AbortSignal {
    return new AbortController().signal;
}

// ---------------------------------------------------------------------------
// Bug 1 — PermissionHandler not initialized with CLI permission mode
// ---------------------------------------------------------------------------

describe('PermissionHandler — CLI permission mode seeding (Bug 1)', () => {
    it('auto-approves tool calls when seedInitialMode(bypassPermissions) is called', async () => {
        const { session } = makeSessionMock();
        const handler = new PermissionHandler(session);

        // Simulate what claudeRemoteLauncher does after applying the fix
        handler.seedInitialMode('bypassPermissions');

        const result = await handler.handleToolCall(
            'Read',
            { file_path: '/tmp/foo.txt' },
            { permissionMode: 'bypassPermissions' } as any,
            { signal: makeAbortSignal(), toolUseID: 'tool-123' },
        );

        expect(result).toEqual({
            behavior: 'allow',
            updatedInput: { file_path: '/tmp/foo.txt' },
        });
    });

    it('enters the permission-request flow when no initial mode is seeded', async () => {
        const { session } = makeSessionMock();
        const handler = new PermissionHandler(session);

        // No seedInitialMode call — defaults to 'default' mode
        const pendingPromise = handler.handleToolCall(
            'Write',
            { file_path: '/tmp/bar.txt', content: 'hello' },
            { permissionMode: 'default' } as any,
            { signal: makeAbortSignal(), toolUseID: 'tool-456' },
        );

        // The call must be pending (not resolved yet) because approval is required
        let resolved = false;
        pendingPromise.then(() => { resolved = true; });

        // Yield microtasks — promise should still be pending
        await new Promise(r => setTimeout(r, 0));
        expect(resolved).toBe(false);

        // Cleanup: abort the signal so the pending request rejects and the test can end
        // We do this by resolving via the RPC handler registered on the session mock.
        // Since we can't easily fire the RPC here, just verify the request was recorded.
        const { getAgentState } = makeSessionMock();
        // The real session mock's agentState would have the request recorded —
        // we confirm the promise did NOT auto-resolve.
        expect(resolved).toBe(false);
    });

    // -----------------------------------------------------------
    // Key regression: reset() must NOT drop back to 'default'
    // -----------------------------------------------------------

    it('preserves bypassPermissions across reset() calls', async () => {
        const { session } = makeSessionMock();
        const handler = new PermissionHandler(session);

        handler.seedInitialMode('bypassPermissions');

        // Simulate what claudeRemoteLauncher does on each new-session detection
        handler.reset();

        // After reset, mode must still be bypassPermissions, NOT 'default'
        const result = await handler.handleToolCall(
            'Bash',
            { command: 'echo hi' },
            { permissionMode: 'bypassPermissions' } as any,
            { signal: makeAbortSignal(), toolUseID: 'tool-789' },
        );

        expect(result).toEqual({
            behavior: 'allow',
            updatedInput: { command: 'echo hi' },
        });
    });

    it('reset() without seedInitialMode still defaults to default mode (safe fallback)', async () => {
        const { session } = makeSessionMock();
        const handler = new PermissionHandler(session);

        handler.reset(); // No initial mode set — should stay 'default'

        const pendingPromise = handler.handleToolCall(
            'Write',
            { file_path: '/tmp/test.txt', content: 'data' },
            { permissionMode: 'default' } as any,
            { signal: makeAbortSignal(), toolUseID: 'tool-reset-001' },
        );

        // Verify the call is pending (not auto-approved)
        let resolved = false;
        pendingPromise.then(() => { resolved = true; });
        await new Promise(r => setTimeout(r, 0));
        expect(resolved).toBe(false);
    });

    it('handleModeChange overrides seedInitialMode for the current turn', async () => {
        const { session } = makeSessionMock();
        const handler = new PermissionHandler(session);

        handler.seedInitialMode('bypassPermissions');

        // Mobile sends a mode change to 'acceptEdits' for this turn
        handler.handleModeChange('acceptEdits');

        // An edit tool should be auto-approved in acceptEdits mode
        const result = await handler.handleToolCall(
            'Edit',
            { file_path: '/tmp/edit.txt', old_string: 'a', new_string: 'b' },
            { permissionMode: 'acceptEdits' } as any,
            { signal: makeAbortSignal(), toolUseID: 'tool-edit-001' },
        );

        expect(result).toEqual({
            behavior: 'allow',
            updatedInput: { file_path: '/tmp/edit.txt', old_string: 'a', new_string: 'b' },
        });
    });

    it('after reset(), seedInitialMode mode is restored even if handleModeChange changed it', async () => {
        const { session } = makeSessionMock();
        const handler = new PermissionHandler(session);

        handler.seedInitialMode('bypassPermissions');
        // Mobile sends default for a turn
        handler.handleModeChange('default');
        // Turn ends → reset()
        handler.reset();

        // Next turn should restore to bypassPermissions
        const result = await handler.handleToolCall(
            'Bash',
            { command: 'ls' },
            { permissionMode: 'default' } as any,
            { signal: makeAbortSignal(), toolUseID: 'tool-restore-001' },
        );

        expect(result).toEqual({
            behavior: 'allow',
            updatedInput: { command: 'ls' },
        });
    });
});
