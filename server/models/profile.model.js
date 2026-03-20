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
        bio: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },
        location: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
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
        privacyLocation: {
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
