import { describe, expect, it } from 'vitest';
import {
    getAvailableModels,
    getAvailablePermissionModes,
    getCodexModelModes,
    getClaudePermissionModes,
    getDefaultPermissionModeKey,
    mapMetadataOptions,
    resolveCurrentOption,
} from './modelModeOptions';

const translate = (key: string) => `tr:${key}`;

describe('modelModeOptions', () => {
    it('maps metadata option shape into mode options', () => {
        expect(mapMetadataOptions([
            { code: 'm1', value: 'Model One', description: 'Primary model' },
            { code: 'm2', value: 'Model Two' },
        ])).toEqual([
            { key: 'm1', name: 'Model One', description: 'Primary model' },
            { key: 'm2', name: 'Model Two', description: null },
        ]);
    });

    it('builds claude permission fallbacks with translated names', () => {
        const modes = getClaudePermissionModes(translate);
        expect(modes.map((mode) => mode.key)).toEqual(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']);
        expect(modes[0].name).toBe('tr:agentInput.permissionMode.default');
    });

    it('builds codex model fallbacks', () => {
        const models = getCodexModelModes();
        expect(models.map((model) => model.key)).toEqual([
            'default',
            'gpt-5.4',
            'gpt-5.3-codex',
            'gpt-5.2-codex',
            'gpt-5.1-codex-max',
            'gpt-5.2',
            'gpt-5.1-codex-mini',
        ]);
        expect(models[0].name).toBe('default model');
        expect(models[1].name).toBe('gpt-5.4');
    });

    it('prefers metadata models over hardcoded fallbacks', () => {
        const models = getAvailableModels('gemini', {
            models: [
                { code: 'custom-gemini', value: 'Gemini Custom', description: 'From metadata' },
            ],
        } as any, translate);

        expect(models).toEqual([
            { key: 'custom-gemini', name: 'Gemini Custom', description: 'From metadata' },
        ]);
    });

    it('adds codex default model option when metadata models are present', () => {
        const models = getAvailableModels('codex', {
            models: [
                { code: 'gpt-5.4', value: 'gpt-5.4', description: 'Latest' },
            ],
        } as any, translate);

        expect(models).toEqual([
            { key: 'default', name: 'default model', description: null },
            { key: 'gpt-5.4', name: 'gpt-5.4', description: 'Latest' },
        ]);
    });

    it('keeps codex permission modes hardcoded even when metadata modes exist', () => {
        const modes = getAvailablePermissionModes('codex', {
            operatingModes: [{ code: 'metadata-only', value: 'Metadata Mode', description: null }],
        } as any, translate);

        expect(modes.map((mode) => mode.key)).toEqual(['default', 'read-only', 'safe-yolo', 'yolo']);
    });

    it('applies hacks to metadata-provided operating modes', () => {
        const modes = getAvailablePermissionModes('gemini', {
            operatingModes: [
                { code: 'build', value: 'build, build', description: 'Do build steps' },
                { code: 'plan', value: 'plan/plan', description: 'Plan first' },
            ],
        } as any, translate);

        expect(modes).toEqual([
            { key: 'build', name: 'Build', description: 'Do build steps' },
            { key: 'plan', name: 'Plan', description: 'Plan first' },
        ]);
    });

    it('resolves the first matching preferred key', () => {
        const options = [
            { key: 'a', name: 'A' },
            { key: 'b', name: 'B' },
        ];

        expect(resolveCurrentOption(options, ['missing', 'b', 'a'])).toEqual({ key: 'b', name: 'B' });
        expect(resolveCurrentOption(options, ['missing'])).toBeNull();
    });

    // -------------------------------------------------------------------------
    // Bug 2 regression: SessionView server-metadata override (SessionView.tsx)
    //
    // Before the fix, resolveCurrentOption for permissionMode used:
    //   [session.permissionMode, session.metadata?.currentOperatingModeCode, getDefaultPermissionModeKey(flavor)]
    //
    // The server-reported currentOperatingModeCode ('acceptEdits') sat between the local mode
    // and the fallback default, so it could silently override the user's local 'bypassPermissions'
    // if `session.permissionMode` happened to be undefined/null (e.g. before the user explicitly
    // touched the picker in the app).
    //
    // After the fix, the preference array is:
    //   [session.permissionMode, getDefaultPermissionModeKey(flavor)]
    //
    // i.e. the server metadata code is entirely absent.
    // -------------------------------------------------------------------------
    describe('resolveCurrentOption — Bug 2: server metadata must not override local mode', () => {
        const availableModes = [
            { key: 'default', name: 'Default' },
            { key: 'acceptEdits', name: 'Accept Edits' },
            { key: 'bypassPermissions', name: 'Bypass' },
        ];

        it('uses local session.permissionMode when set', () => {
            // Fixed preference order: [session.permissionMode, defaultKey]
            expect(resolveCurrentOption(availableModes, [
                'bypassPermissions',
                getDefaultPermissionModeKey('claude'),
            ])).toEqual({ key: 'bypassPermissions', name: 'Bypass' });
        });

        it('falls back to app default when session.permissionMode is not set', () => {
            // session.permissionMode is null/undefined → falls through to getDefaultPermissionModeKey
            expect(resolveCurrentOption(availableModes, [
                undefined,
                getDefaultPermissionModeKey('claude'),
            ])).toEqual({ key: 'default', name: 'Default' });
        });

        it('OLD behavior: server acceptEdits would win over no local mode (documents the bug)', () => {
            // This simulates the old three-element preference array that included
            // currentOperatingModeCode between session.permissionMode and the default.
            // When session.permissionMode is unset, the server code ('acceptEdits') wins.
            const oldPreferenceArray = [
                undefined,                       // session.permissionMode (not set yet)
                'acceptEdits',                   // session.metadata?.currentOperatingModeCode
                getDefaultPermissionModeKey('claude'), // 'default'
            ];
            expect(resolveCurrentOption(availableModes, oldPreferenceArray))
                .toEqual({ key: 'acceptEdits', name: 'Accept Edits' }); // BUG: server wins
        });

        it('NEW behavior: without server code in array, default wins (not server mode)', () => {
            // This is the fixed preference array — server metadata is absent.
            const newPreferenceArray = [
                undefined,                       // session.permissionMode (not set yet)
                getDefaultPermissionModeKey('claude'), // 'default'
            ];
            expect(resolveCurrentOption(availableModes, newPreferenceArray))
                .toEqual({ key: 'default', name: 'Default' }); // FIXED: app default wins
        });

        it('local bypassPermissions is never shadowed by server acceptEdits in new array', () => {
            // Verify that even if server would have sent 'acceptEdits', it has no effect
            // because it is not in the preference array at all.
            const newPreferenceArray = [
                'bypassPermissions',
                getDefaultPermissionModeKey('claude'),
            ];
            expect(resolveCurrentOption(availableModes, newPreferenceArray))
                .toEqual({ key: 'bypassPermissions', name: 'Bypass' });
        });
    });
});
