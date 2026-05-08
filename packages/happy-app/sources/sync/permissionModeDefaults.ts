import type { PermissionModeKey } from '@/components/PermissionModeSelector';
import type { Session } from './storageTypes';

export function isSandboxEnabled(metadata: Session['metadata'] | null | undefined): boolean {
    const sandbox = metadata?.sandbox;
    return !!sandbox && typeof sandbox === 'object' && (sandbox as { enabled?: unknown }).enabled === true;
}

const KNOWN_PERMISSION_MODES: ReadonlySet<string> = new Set([
    'default',
    'acceptEdits',
    'bypassPermissions',
    'plan',
    'read-only',
    'safe-yolo',
    'yolo',
]);

export function resolveInitialPermissionMode(metadata: Session['metadata'] | null | undefined): PermissionModeKey | null {
    if (isSandboxEnabled(metadata)) {
        return 'bypassPermissions';
    }
    const initial = metadata?.initialPermissionMode;
    if (typeof initial === 'string' && KNOWN_PERMISSION_MODES.has(initial)) {
        return initial;
    }
    if (metadata?.dangerouslySkipPermissions) {
        return 'bypassPermissions';
    }
    return null;
}

export function resolveSessionPermissionMode(options: {
    existingPermissionMode?: string | null;
    savedPermissionMode?: string | null;
    incomingPermissionMode?: string | null;
    metadata?: Session['metadata'] | null;
}): PermissionModeKey {
    // savedPermissionMode comes from MMKV and represents a deliberate user choice — including an
    // explicit downgrade to 'default'. It must beat initialPermissionMode so that a user who
    // switches from 'bypassPermissions' to 'default' in the UI keeps that choice across server
    // sync cycles. existingPermissionMode (in-memory only) and incomingPermissionMode (from server,
    // always undefined) are still excluded when 'default' because they may reflect the seeded
    // initial value rather than a deliberate user action.
    if (options.savedPermissionMode != null && KNOWN_PERMISSION_MODES.has(options.savedPermissionMode)) {
        return options.savedPermissionMode as PermissionModeKey;
    }
    return (
        (options.existingPermissionMode && options.existingPermissionMode !== 'default' ? options.existingPermissionMode : undefined) ||
        (options.incomingPermissionMode && options.incomingPermissionMode !== 'default' ? options.incomingPermissionMode : undefined) ||
        resolveInitialPermissionMode(options.metadata) ||
        'default'
    );
}
