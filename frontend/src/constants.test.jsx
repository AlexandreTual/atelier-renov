import { describe, it, expect } from 'vitest';
import { STATUSES } from './constants';

const EXPECTED_KEYS = [
    'to_be_cleaned',
    'cleaning',
    'repairing',
    'drying',
    'ready_for_sale',
    'selling',
    'sold',
];

describe('STATUSES', () => {
    it('contains all expected status keys', () => {
        for (const key of EXPECTED_KEYS) {
            expect(STATUSES).toHaveProperty(key);
        }
    });

    it('each status has a label, color and icon', () => {
        for (const key of EXPECTED_KEYS) {
            const status = STATUSES[key];
            expect(typeof status.label).toBe('string');
            expect(status.label.length).toBeGreaterThan(0);
            expect(typeof status.color).toBe('string');
            expect(status.icon).toBeTruthy();
        }
    });
});
