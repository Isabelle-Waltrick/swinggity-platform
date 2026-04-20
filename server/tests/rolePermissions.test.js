import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canCreateOrManageEvents,
    canDeleteCalendarEvent,
    canJamCircleInvite,
    canMarkCalendarEventGoing,
    canSubmitOrganiserVerificationRequest,
} from '../utils/rolePermissions.js';

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

test('organiser and admin can create/manage events', () => {
    assert.equal(canCreateOrManageEvents('organiser'), true);
    assert.equal(canCreateOrManageEvents('organizer'), true);
    assert.equal(canCreateOrManageEvents('admin'), true);
    assert.equal(canCreateOrManageEvents('regular'), false);
});

test('delete calendar event permissions respect owner and admin rules', () => {
    assert.equal(
        canDeleteCalendarEvent({ role: 'organiser', isEventOwner: true }),
        true
    );
    assert.equal(
        canDeleteCalendarEvent({ role: 'organiser', isEventOwner: false }),
        false
    );
    assert.equal(
        canDeleteCalendarEvent({ role: 'admin', isEventOwner: false }),
        true
    );
    assert.equal(
        canDeleteCalendarEvent({ role: 'regular', isEventOwner: true }),
        false
    );
});

test('admins cannot mark Going on events', () => {
    assert.equal(canMarkCalendarEventGoing('admin'), false);
    assert.equal(canMarkCalendarEventGoing('organiser'), true);
    assert.equal(canMarkCalendarEventGoing('regular'), true);
});

test('only non-organiser/non-admin can submit organiser verification request', () => {
    assert.equal(canSubmitOrganiserVerificationRequest('regular'), true);
    assert.equal(canSubmitOrganiserVerificationRequest('organiser'), false);
    assert.equal(canSubmitOrganiserVerificationRequest('organizer'), false);
    assert.equal(canSubmitOrganiserVerificationRequest('admin'), false);
});
