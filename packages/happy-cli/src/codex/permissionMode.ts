import type { PermissionMode } from '@/api/types';

export const VALID_CODEX_PERMISSION_MODES: readonly PermissionMode[] = [
    'default',
    'read-only',
    'safe-yolo',
    'yolo',
];

export function resolveIncomingCodexPermissionMode(options: {
    incoming: unknown;
    currentPermissionMode: PermissionMode | undefined;
    initialPermissionMode: PermissionMode | undefined;
    /** true when the sender deliberately chose this mode (permissionModeExplicit from app) */
    explicit?: boolean;
}): { permissionMode: PermissionMode | undefined; shouldUpdateCurrent: boolean; ignored: boolean } {
    const { incoming, currentPermissionMode, initialPermissionMode, explicit } = options;
    if (!VALID_CODEX_PERMISSION_MODES.includes(incoming as PermissionMode)) {
        return {
            permissionMode: currentPermissionMode,
            shouldUpdateCurrent: false,
            ignored: true,
        };
    }

    const incomingMode = incoming as PermissionMode;
    // Protect against legacy builds (without permissionModeExplicit) that always send 'default'
    // as a fallback — that must not override a configured non-default initial mode.
    // New builds set explicit: true when the user deliberately chose 'default', in which case
    // we must honor the downgrade.
    if (incomingMode === 'default' && !explicit && initialPermissionMode && initialPermissionMode !== 'default') {
        return {
            permissionMode: currentPermissionMode,
            shouldUpdateCurrent: false,
            ignored: true,
        };
    }

    return {
        permissionMode: incomingMode,
        shouldUpdateCurrent: true,
        ignored: false,
    };
}
