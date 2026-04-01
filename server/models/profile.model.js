import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        displayFirstName: {
            type: String,
            default: "",
            trim: true,
            maxlength: 50,
        },
        displayLastName: {
            type: String,
            default: "",
            trim: true,
            maxlength: 50,
        },
        avatarUrl: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },
        avatarStorageId: {
            type: String,
            default: "",
            trim: true,
            maxlength: 250,
        },
        bio: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },
        pronouns: {
            type: String,
            default: "",
            trim: true,
            maxlength: 50,
        },
        contactEmail: {
            type: String,
            default: "",
            trim: true,
            maxlength: 254,
        },
        phoneNumber: {
            type: String,
            default: "",
            trim: true,
            maxlength: 30,
        },
        instagram: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
        },
        facebook: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
        },
        youtube: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
        },
        linkedin: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
        },
        website: {
            type: String,
            default: "",
            trim: true,
            maxlength: 300,
        },
        profileTags: {
            type: [String],
            default: [],
            validate: {
                validator: (tags) => Array.isArray(tags) && tags.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.trim().length <= 40),
                message: "Each profile tag must be a non-empty string up to 40 characters",
            },
        },
        jamCircle: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },
        jamCircleMembers: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }],
            default: [],
        },
        blockedMembers: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }],
            default: [],
        },
        pendingCircleInvitations: {
            type: [{
                tokenHash: {
                    type: String,
                    required: true,
                    trim: true,
                },
                invitedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                invitedByName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                invitedByAvatarUrl: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 500,
                },
                invitedAt: {
                    type: Date,
                    default: Date.now,
                },
                expiresAt: {
                    type: Date,
                    required: true,
                },
            }],
            default: [],
        },
        pendingCoHostInvitations: {
            type: [{
                tokenHash: {
                    type: String,
                    required: true,
                    trim: true,
                },
                eventId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "CalendarEvent",
                    required: true,
                },
                eventTitle: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                invitedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                invitedByName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                invitedByAvatarUrl: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 500,
                },
                contactType: {
                    type: String,
                    enum: ["member", "organisation"],
                    required: true,
                },
                contactDisplayName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                organisationId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Organisation",
                    default: null,
                },
                invitedAt: {
                    type: Date,
                    default: Date.now,
                },
                expiresAt: {
                    type: Date,
                    required: true,
                },
            }],
            default: [],
        },
        pendingOrganisationInvitations: {
            type: [{
                tokenHash: {
                    type: String,
                    required: true,
                    trim: true,
                },
                organisationId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Organisation",
                    required: true,
                },
                organisationName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                invitedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                invitedByName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                invitedByAvatarUrl: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 500,
                },
                contactDisplayName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                invitedAt: {
                    type: Date,
                    default: Date.now,
                },
                expiresAt: {
                    type: Date,
                    required: true,
                },
            }],
            default: [],
        },
        coHostInvitationResponses: {
            type: [{
                eventId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "CalendarEvent",
                    required: true,
                },
                eventTitle: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                inviteeUser: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                inviteeName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                inviteeAvatarUrl: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 500,
                },
                response: {
                    type: String,
                    enum: ["accept", "deny"],
                    required: true,
                },
                respondedAt: {
                    type: Date,
                    default: Date.now,
                },
            }],
            default: [],
        },
        organisationInvitationResponses: {
            type: [{
                organisationId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Organisation",
                    required: true,
                },
                organisationName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                inviteeUser: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                inviteeName: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 120,
                },
                inviteeAvatarUrl: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 500,
                },
                response: {
                    type: String,
                    enum: ["accept", "deny"],
                    required: true,
                },
                respondedAt: {
                    type: Date,
                    default: Date.now,
                },
            }],
            default: [],
        },
        interests: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },
        activity: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },
        activityFeed: {
            type: [{
                type: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: 40,
                },
                entityType: {
                    type: String,
                    default: "",
                    trim: true,
                    maxlength: 40,
                },
                entityId: {
                    type: mongoose.Schema.Types.ObjectId,
                    default: null,
                },
                message: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: 220,
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            }],
            default: [],
        },
        privacyMembers: {
            type: String,
            enum: ["anyone", "circle", "mutual", "nobody"],
            default: "anyone",
        },
        privacyContact: {
            type: String,
            enum: ["anyone", "circle", "mutual", "nobody"],
            default: "anyone",
        },
        privacyBio: {
            type: String,
            enum: ["anyone", "circle", "mutual", "nobody"],
            default: "anyone",
        },
        privacySocialLinks: {
            type: String,
            enum: ["anyone", "circle", "mutual", "nobody"],
            default: "anyone",
        },
        privacyPosts: {
            type: String,
            enum: ["anyone", "circle", "mutual", "nobody"],
            default: "anyone",
        },
        privacyTags: {
            type: String,
            enum: ["anyone", "circle", "mutual", "nobody"],
            default: "anyone",
        },
    },
    { timestamps: true }
);

export const Profile = mongoose.model("Profile", profileSchema);
