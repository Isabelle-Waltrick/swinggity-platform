import test from 'node:test';
import assert from 'node:assert/strict';
import { canJamCircleInvite } from '../utils/rolePermissions.js';

test('admin cannot invite member to Jam Circle', () => {
    assert.equal(
        canJamCircleInvite({ inviterRole: 'admin', inviteeRole: 'member' }),
        false
    );
});

test('member cannot invite admin to Jam Circle', () => {
    assert.equal(
        canJamCircleInvite({ inviterRole: 'member', inviteeRole: 'admin' }),
        false
    );
});

test('organiser can invite member to Jam Circle', () => {
    assert.equal(
        canJamCircleInvite({ inviterRole: 'organiser', inviteeRole: 'member' }),
        true
    );
});
