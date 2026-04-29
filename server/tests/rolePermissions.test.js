// The code in this file were created with help of AI (Copilot)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canAcceptJamCircleInvitation,
    canDeleteMemberAccountAsAdmin,
    canCreateOrManageEvents,
    canDeleteCalendarEvent,
    canEditOwnProfile,
    canJamCircleInvite,
    canMarkCalendarEventGoing,
    canSubmitOrganiserVerificationRequest,
    canUpdateMemberRole,
    getJamCircleInviteRoleDecision,
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

test('jam circle invite decision returns inviter-admin reason first', () => {
    assert.deepEqual(
        getJamCircleInviteRoleDecision({ inviterRole: 'admin', inviteeRole: 'admin' }),
        { allowed: false, reason: 'inviter-is-admin' }
    );
    assert.deepEqual(
        getJamCircleInviteRoleDecision({ inviterRole: 'regular', inviteeRole: 'admin' }),
        { allowed: false, reason: 'invitee-is-admin' }
    );
    assert.deepEqual(
        getJamCircleInviteRoleDecision({ inviterRole: 'organiser', inviteeRole: 'regular' }),
        { allowed: true, reason: 'allowed' }
    );
});

test('admins cannot accept jam circle invitations', () => {
    assert.equal(canAcceptJamCircleInvitation('admin'), false);
    assert.equal(canAcceptJamCircleInvitation('organiser'), true);
    assert.equal(canAcceptJamCircleInvitation('regular'), true);
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

test('canEditOwnProfile only allows self-target edits', () => {
    assert.equal(
        canEditOwnProfile({
            requesterUserId: '64f1f77bcf86cd7994390111',
            targetUserId: '64f1f77bcf86cd7994390222',
        }),
        false
    );
    assert.equal(
        canEditOwnProfile({
            requesterUserId: '64f1f77bcf86cd7994390111',
            targetUserId: '64f1f77bcf86cd7994390111',
        }),
        true
    );
});

test('only admins can update member roles', () => {
    assert.equal(canUpdateMemberRole('admin'), true);
    assert.equal(canUpdateMemberRole('organiser'), false);
    assert.equal(canUpdateMemberRole('regular'), false);
});

test('only admins can delete member accounts via admin endpoint', () => {
    assert.equal(canDeleteMemberAccountAsAdmin('admin'), true);
    assert.equal(canDeleteMemberAccountAsAdmin('organiser'), false);
    assert.equal(canDeleteMemberAccountAsAdmin('regular'), false);
});
