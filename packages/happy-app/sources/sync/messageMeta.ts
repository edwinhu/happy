import type { Session } from './storageTypes';
import type { PermissionModeKey } from '@/components/PermissionModeSelector';
import { isSandboxEnabled } from './permissionModeDefaults';

export function resolveMessageModeMeta(
    session: Pick<Session, 'permissionMode' | 'modelMode' | 'metadata' | 'effortLevel'>,
): { permissionMode: PermissionModeKey; permissionModeExplicit: boolean; model: string | null; effort: string | null } {
    // Sandbox always wins regardless of what the session says.
    if (isSandboxEnabled(session.metadata)) {
        const modelMode = session.modelMode || 'default';
        return {
            permissionMode: 'bypassPermissions',
            permissionModeExplicit: true,
            model: modelMode !== 'default' ? modelMode : null,
            effort: session.effortLevel ?? null,
        };
    }

    // Trust session.permissionMode as-is. resolveSessionPermissionMode (called in applySessions)
    // is the authoritative place that seeds session.permissionMode from initialPermissionMode.
    // By the time we reach here the value is already resolved. If it is still 'default' that
    // means either (a) no initialPermissionMode existed (so 'default' is correct) or (b) the
    // user explicitly switched to 'default' in the UI and we must honor that, NOT override it
    // with initialPermissionMode again.
    const permissionMode: PermissionModeKey = (session.permissionMode ?? 'default') as PermissionModeKey;

    const modelMode = session.modelMode || 'default';
    const model = modelMode !== 'default' ? modelMode : null;

    // Effort flows through user-message meta: CLI runners (claude/codex) read
    // it on each turn and pass through to the SDK call. Null tells the runner
    // to keep its own default — we only pin a level when the user explicitly
    // chose one in the UI.
    const effort = session.effortLevel ?? null;

    return {
        permissionMode,
        // Always mark as explicit: this app version uses resolveSessionPermissionMode as the
        // authoritative seeder, so whatever permissionMode we send is a deliberate value —
        // the CLI should not discard it as a legacy-build 'default' fallback.
        permissionModeExplicit: true,
        model,
        effort,
    };
}
