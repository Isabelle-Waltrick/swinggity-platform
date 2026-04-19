import { useEffect, useState } from 'react';

const DELETE_ACCOUNT_CONFIRMATION_TEXT = "Yes, please delete this user's account account";

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
    const [menuActionState, setMenuActionState] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMemberContactPopupOpen, setIsMemberContactPopupOpen] = useState(false);
    const [contactTargetName, setContactTargetName] = useState('');
    const [contactTargetUserId, setContactTargetUserId] = useState('');
    const [invitePopup, setInvitePopup] = useState({
        isOpen: false,
        title: '',
        message: '',
    });
    const [isDeleteMemberPopupOpen, setIsDeleteMemberPopupOpen] = useState(false);
    const [isDeletingMemberAccount, setIsDeletingMemberAccount] = useState(false);
    const [deleteMemberConfirmation, setDeleteMemberConfirmation] = useState('');
    const [deleteMemberError, setDeleteMemberError] = useState('');
    const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
    const [reportReasons, setReportReasons] = useState([]);
    const [reportDetails, setReportDetails] = useState('');
    const [reportError, setReportError] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [selectedMemberRole, setSelectedMemberRole] = useState('regular');
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isUpdatingMemberRole, setIsUpdatingMemberRole] = useState(false);
    const [memberRoleUpdateError, setMemberRoleUpdateError] = useState('');
    const [showContactBlockedHint, setShowContactBlockedHint] = useState(false);

    useEffect(() => {
        setShowContactBlockedHint(false);
    }, [member?.userId]);

    useEffect(() => {
        const normalizedRole = String(member?.role || '').trim().toLowerCase();
        if (normalizedRole === 'regular' || normalizedRole === 'organiser' || normalizedRole === 'admin') {
            setSelectedMemberRole(normalizedRole);
        }
    }, [member?.role]);

    const normalizedMemberRole = String(member?.role || '').trim().toLowerCase();
    const selectedMemberRoleLabel = roleLabels[selectedMemberRole] || 'Regular';
    const isDeleteMemberConfirmationValid = deleteMemberConfirmation.trim() === DELETE_ACCOUNT_CONFIRMATION_TEXT;

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

    const openMemberContactPopup = (name, userId) => {
        setContactTargetName(String(name || '').trim() || 'this user');
        setContactTargetUserId(String(userId || '').trim());
        setIsMemberContactPopupOpen(true);
    };

    const closeMemberContactPopup = () => {
        setIsMemberContactPopupOpen(false);
        setContactTargetName('');
        setContactTargetUserId('');
    };

    const openInvitePopup = (title, message) => {
        setInvitePopup({
            isOpen: true,
            title,
            message,
        });
    };

    const closeInvitePopup = () => {
        setInvitePopup({
            isOpen: false,
            title: '',
            message: '',
        });
    };

    const handleBlockedContactAttempt = (event) => {
        event.preventDefault();
        setShowContactBlockedHint(true);
    };

    const openReportPopup = () => {
        setIsMenuOpen(false);
        setIsReportPopupOpen(true);
        setReportReasons([]);
        setReportDetails('');
        setReportError('');
    };

    const closeReportPopup = () => {
        if (isSubmittingReport) return;
        setIsReportPopupOpen(false);
        setReportReasons([]);
        setReportDetails('');
        setReportError('');
    };

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

    const onDeleteMemberConfirmationChange = (value) => {
        setDeleteMemberConfirmation(value);
        setDeleteMemberError('');
    };

    const onReportDetailsChange = (value) => {
        setReportDetails(value);
        setReportError('');
    };

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

    const handleDeleteMemberPlaceholder = () => {
        if (!isAdminUser || isOrganisationProfile || member?.isCurrentUser) return;
        setDeleteMemberConfirmation('');
        setDeleteMemberError('');
        setIsDeleteMemberPopupOpen(true);
    };

    const closeDeleteMemberPopup = () => {
        if (isDeletingMemberAccount) return;
        setIsDeleteMemberPopupOpen(false);
        setDeleteMemberConfirmation('');
        setDeleteMemberError('');
    };

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
            const response = await fetch(`${apiUrl}/api/members/${encodeURIComponent(String(member.userId))}/profile`, {
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

    const handleAdminRoleSelect = (role) => {
        const normalizedRole = String(role || '').trim().toLowerCase();
        if (!roleLabels[normalizedRole]) return;

        setSelectedMemberRole(normalizedRole);
        setMemberRoleUpdateError('');
        setIsRoleDropdownOpen(false);
    };

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

