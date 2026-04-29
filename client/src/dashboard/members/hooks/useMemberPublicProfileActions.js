// The code in this file were created with help of AI (Copilot)

import { useEffect, useState } from 'react';

// Typed confirmation string protects destructive account deletion behind explicit user intent.
const DELETE_ACCOUNT_CONFIRMATION_TEXT = "Yes, please delete this user's account account";

/**
 * useMemberPublicProfileActions:
 * Centralizes all interaction state and handlers for the public member profile page,
 * including profile reporting, role updates, invitations, blocking, and account deletion.
 */
export default function useMemberPublicProfileActions({
    apiUrl,
    profileId,
    member,
    setMember,
    navigate,
    isAdminUser,
    isOrganisationProfile,
    isViewedMemberAdmin,
    roleLabels,
}) {
    // Shared menu action state prevents overlapping async actions from running at once.
    const [menuActionState, setMenuActionState] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Contact popup state tracks target user details for in-app messaging flows.
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
    // Generic feedback popup is reused for success/failure style status messaging.
    const [invitePopup, setInvitePopup] = useState({
        isOpen: false,
        title: '', message: '',
    });
    // Admin deletion modal state tracks confirmation text, pending state, and failures.
    const [isDeleteMemberPopupOpen, setIsDeleteMemberPopupOpen] = useState(false);
    const [isDeletingMemberAccount, setIsDeletingMemberAccount] = useState(false);
    const [deleteMemberConfirmation, setDeleteMemberConfirmation] = useState('');
    const [deleteMemberError, setDeleteMemberError] = useState('');
    // Report popup state tracks selected report reasons and optional free-text details.
    const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
    const [reportReasons, setReportReasons] = useState([]);
    const [reportDetails, setReportDetails] = useState('');
    const [reportError, setReportError] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    // Admin role controls manage role dropdown state and role update lifecycle.
    const [selectedMemberRole, setSelectedMemberRole] = useState('regular');
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isUpdatingMemberRole, setIsUpdatingMemberRole] = useState(false);
    const [memberRoleUpdateError, setMemberRoleUpdateError] = useState('');
    // Hint flag explains why contact may be blocked after specific actions.
    const [showContactBlockedHint, setShowContactBlockedHint] = useState(false);

    // Reset blocked-contact hint when navigating to a different viewed member.
    useEffect(() => {
        setShowContactBlockedHint(false);
    }, [member?.userId]);

    // Keep selected role synced with member payload so dropdown reflects server state.
    useEffect(() => {
        const normalizedRole = String(member?.role || '').trim().toLowerCase();
        if (normalizedRole === 'regular' || normalizedRole === 'organiser' || normalizedRole === 'admin') {
            setSelectedMemberRole(normalizedRole);
        }
    }, [member?.role]);

    // Derived role labels and confirmation checks keep render logic simple for consumers.
    const normalizedMemberRole = String(member?.role || '').trim().toLowerCase();
    const selectedMemberRoleLabel = roleLabels[selectedMemberRole] || 'Regular';
    const isDeleteMemberConfirmationValid = deleteMemberConfirmation.trim() === DELETE_ACCOUNT_CONFIRMATION_TEXT;

    // Open member social links through the backend proxy route for normalized URL handling.
    const openSocialLink = (socialKey) => {
        const memberIdPart = encodeURIComponent(String(profileId || ''));
        const platformPart = encodeURIComponent(String(socialKey || ''));
        const socialPath = `/api/members/${memberIdPart}/social/${platformPart}`;

        const link = document.createElement('a');
        link.href = socialPath;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
    };
    // Open contact popup with a safe fallback label when member name is absent.
    const openMemberContactPopup = (name, userId) => {
        setContactTargetName(String(name || '').trim() || 'this user');
        setContactTargetUserId(String(userId || '').trim());
        setIsMemberContactPopupOpen(true);
    };
    // Reset contact popup state after close to avoid stale target data.
    const closeMemberContactPopup = () => {
        setIsMemberContactPopupOpen(false);
        setContactTargetName('');
        setContactTargetUserId('');
    };
    // Shared popup opener for invite/report status messages.
    const openInvitePopup = (title, message) => {
        setInvitePopup({
            isOpen: true,
            title,
            message,
        });
    };
    // Reset popup state completely on close.
    const closeInvitePopup = () => {
        setInvitePopup({
            isOpen: false,
            title: '',
            message: '',
        });
    };
    // Blocked contact attempts show a contextual hint rather than failing silently.
    const handleBlockedContactAttempt = (event) => {
        event.preventDefault();
        setShowContactBlockedHint(true);
    };
    // Reporting starts from a clean state each time the popup opens.
    const openReportPopup = () => {
        setIsMenuOpen(false);
        setIsReportPopupOpen(true);
        setReportReasons([]);
        setReportDetails('');
        setReportError('');
    };
    // Prevent closing during submit so users cannot interrupt in-flight report requests.
    const closeReportPopup = () => {
        if (isSubmittingReport) return;
        setIsReportPopupOpen(false);
        setReportReasons([]);
        setReportDetails('');
        setReportError('');
    };
    // Report reasons are multi-select and toggled by inclusion.
    const toggleReportReason = (reason) => {
        const normalizedReason = String(reason || '').trim();
        if (!normalizedReason) return;

        setReportReasons((currentReasons) => {
            if (currentReasons.includes(normalizedReason)) {
                return currentReasons.filter((item) => item !== normalizedReason);
            }
            return [...currentReasons, normalizedReason];
        });
        setReportError('');
    };
    // Clear deletion errors as the admin updates confirmation text.
    const onDeleteMemberConfirmationChange = (value) => {
        setDeleteMemberConfirmation(value);
        setDeleteMemberError('');
    };
    // Clear report errors as the user updates optional details.
    const onReportDetailsChange = (value) => {
        setReportDetails(value);
        setReportError('');
    };
    // Submit profile report with selected reasons and optional additional context.
    const handleSubmitProfileReport = async () => {
        const memberId = String(member?.userId || '').trim();
        if (!memberId || isSubmittingReport) return;

        if (reportReasons.length === 0) {
            setReportError('Please choose at least one reason.');
            return;
        }
        setIsSubmittingReport(true);
        setReportError('');
        try {
            // Report endpoint expects reasons array and optional details payload.
            const response = await fetch(`${apiUrl}/api/members/${encodeURIComponent(memberId)}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    reasons: reportReasons,
                    additionalDetails: reportDetails,
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to submit this profile report.');
            }
            setIsReportPopupOpen(false);
            setReportReasons([]);
            setReportDetails('');
            setReportError('');
            openInvitePopup('Flag submitted', 'Thanks for the report. Our team will review this profile.');
        } catch (submitError) {
            setReportError(submitError.message || 'Unable to submit this profile report.');
        } finally {
            setIsSubmittingReport(false);
        }
    };
    // Open delete-account confirmation popup only when action is valid for current admin context.
    const handleDeleteMemberPlaceholder = () => {
        if (!isAdminUser || isOrganisationProfile || member?.isCurrentUser) return;
        setDeleteMemberConfirmation('');
        setDeleteMemberError('');
        setIsDeleteMemberPopupOpen(true);
    };
    // Keep popup closure blocked while deletion request is in progress.
    const closeDeleteMemberPopup = () => {
        if (isDeletingMemberAccount) return;
        setIsDeleteMemberPopupOpen(false);
        setDeleteMemberConfirmation('');
        setDeleteMemberError('');
    };
    // Persist admin-selected role after validating role value against allowed labels.
    const handleAdminRoleSave = async () => {
        if (!isAdminUser || isOrganisationProfile || member?.isCurrentUser || !member?.userId || isUpdatingMemberRole) return;

        const nextRole = String(selectedMemberRole || '').trim().toLowerCase();
        if (!roleLabels[nextRole]) {
            setMemberRoleUpdateError('Invalid role selected.');
            return;
        }

        setIsUpdatingMemberRole(true);
        setMemberRoleUpdateError('');

        try {
            // Role patch updates member privileges and role-driven UI behavior.
            const response = await fetch(`${apiUrl}/api/members/${encodeURIComponent(String(member.userId))}/role`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ role: nextRole }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to update member role.');
            }

            const updatedRole = String(data?.updatedMemberRole || nextRole).trim().toLowerCase();
            setMember((previous) => (previous ? { ...previous, role: updatedRole } : previous));
            setSelectedMemberRole(updatedRole);
        } catch (saveError) {
            setMemberRoleUpdateError(saveError.message || 'Unable to update member role.');
        } finally {
            setIsUpdatingMemberRole(false);
        }
    };
    // Role dropdown selection updates local choice and clears stale errors.
    const handleAdminRoleSelect = (role) => {
        const normalizedRole = String(role || '').trim().toLowerCase();
        if (!roleLabels[normalizedRole]) return;

        setSelectedMemberRole(normalizedRole);
        setMemberRoleUpdateError('');
        setIsRoleDropdownOpen(false);
    };
    // Final account deletion request for admins after confirmation text passes validation.
    const handleDeleteMemberAccount = async () => {
        const memberId = String(member?.userId || '').trim();
        if (!isDeleteMemberConfirmationValid || !memberId || isDeletingMemberAccount) return;

        setIsDeletingMemberAccount(true);
        setDeleteMemberError('');

        try {
            const response = await fetch(`${apiUrl}/api/members/${encodeURIComponent(memberId)}/account`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete member account.');
            }

            setIsDeleteMemberPopupOpen(false);
            setIsMenuOpen(false);
            navigate('/dashboard/members');
        } catch (error) {
            setDeleteMemberError(error.message || 'Unable to delete member account.');
        } finally {
            setIsDeletingMemberAccount(false);
        }
    };
    // Send Jam Circle invitation unless role rules block the operation.
    const handleInvite = async () => {
        if (isAdminUser) {
            openInvitePopup('Unable to invite', 'Admin accounts cannot add members to a Jam Circle.');
            return;
        }

        if (isViewedMemberAdmin) {
            openInvitePopup('Unable to invite', 'Admin accounts cannot be added to a Jam Circle.');
            return;
        }

        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        // Track active action to disable duplicate menu actions during request.
        setMenuActionState('invite');
        try {
            const response = await fetch(`${apiUrl}/api/jam-circle/members/${encodeURIComponent(memberId)}/invite`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to send invitation.');
            }

            setIsMenuOpen(false);
            openInvitePopup('All Set', 'Your invitation was sent.');
        } catch (inviteError) {
            openInvitePopup('Unable to send invitation', inviteError.message || 'Unable to send invitation.');
        } finally {
            setMenuActionState('');
        }
    };
    // Remove member from current user's Jam Circle relationship.
    const handleRemoveFromJamCircle = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('remove');
        try {
            const response = await fetch(`${apiUrl}/api/jam-circle/profile/jam-circle/${encodeURIComponent(memberId)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to remove member from Jam Circle.');
            }

            setIsMenuOpen(false);
            window.alert('Member removed from your Jam Circle.');
        } catch (removeError) {
            window.alert(removeError.message || 'Unable to remove member from Jam Circle.');
        } finally {
            setMenuActionState('');
        }
    };
    // Block member through member safety endpoint and redirect after success.
    const handleBlockMember = async () => {
        const memberId = String(member?.userId || '');
        if (!memberId || menuActionState) return;

        setMenuActionState('block');
        try {
            const response = await fetch(`${apiUrl}/api/member-safety/blocked-members/${encodeURIComponent(memberId)}`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to block member.');
            }

            setIsMenuOpen(false);
            navigate('/dashboard/members');
        } catch (blockError) {
            window.alert(blockError.message || 'Unable to block member.');
        } finally {
            setMenuActionState('');
        }
    };
    // Expose state and handlers for member public profile screens.
    return {
        menuActionState,
        isMenuOpen,
        setIsMenuOpen,
        isMemberContactPopupOpen,
        contactTargetName,
        contactTargetUserId,
        invitePopup,
        isDeleteMemberPopupOpen,
        isDeletingMemberAccount,
        deleteMemberConfirmation,
        deleteMemberError,
        isReportPopupOpen,
        reportReasons,
        reportDetails,
        reportError,
        isSubmittingReport,
        selectedMemberRole,
        selectedMemberRoleLabel,
        normalizedMemberRole,
        isRoleDropdownOpen,
        setIsRoleDropdownOpen,
        isUpdatingMemberRole,
        memberRoleUpdateError,
        showContactBlockedHint,
        setShowContactBlockedHint,
        isDeleteMemberConfirmationValid,
        openSocialLink,
        openMemberContactPopup,
        closeMemberContactPopup,
        closeInvitePopup,
        handleBlockedContactAttempt,
        openReportPopup,
        closeReportPopup,
        toggleReportReason,
        handleSubmitProfileReport,
        handleDeleteMemberPlaceholder,
        closeDeleteMemberPopup,
        handleAdminRoleSave,
        handleAdminRoleSelect,
        handleDeleteMemberAccount,
        handleInvite,
        handleRemoveFromJamCircle,
        handleBlockMember,
        onDeleteMemberConfirmationChange,
        onReportDetailsChange,
    };
}

