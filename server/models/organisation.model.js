// The code in this file were created with help of AI (Copilot)

import mongoose from "mongoose";

// DBSR03 (partial): schema validation is enforced at the Mongoose/application layer only (required, maxlength, trim, type).
// No native MongoDB $jsonSchema validator is set on the collection, so rules are bypassed by direct database writes.
const organisationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        organisationName: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
        },
        imageUrl: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },
        imageStorageId: {
            type: String,
            default: "",
            trim: true,
            maxlength: 250,
        },
        bio: {
            type: String,
            default: "",
            trim: true,
            maxlength: 700,
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
        participants: {
            type: String,
            default: "",
            trim: true,
            maxlength: 400,
        },
        participantContacts: {
            type: [
                {
                    user: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                        required: true,
                    },
                    entityType: {
                        type: String,
                        enum: ["member", "organisation"],
                        default: "member",
                    },
                    organisationId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Organisation",
                        default: null,
                    },
                    displayName: {
                        type: String,
                        default: "",
                        trim: true,
                        maxlength: 120,
                    },
                    avatarUrl: {
                        type: String,
                        default: "",
                        trim: true,
                        maxlength: 500,
                    },
                },
            ],
            default: [],
        },
    },
    { timestamps: true }
);

export const Organisation = mongoose.model("Organisation", organisationSchema, "organisation");
