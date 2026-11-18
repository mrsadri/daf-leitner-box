import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validSettings } from '../src/core/settingsValidation.ts';
test('settings reject malformed types, unknown keys and unsafe rates', () => {
 assert.deepEqual(validSettings({ language: 'en', soundEnabled: 'false', speechRate: 100, injected: true }), { language: 'en' });
 assert.deepEqual(validSettings(null), {});
 assert.deepEqual(validSettings({ speechRate: .9, autoSpeak: false }), { speechRate: .9, autoSpeak: false });
});
