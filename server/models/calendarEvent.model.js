// The code in this file were created with help of AI (Copilot)

/**
 * Calendar Event Model Guide
 * This schema defines what an event record looks like in the database.
 * It includes core details, attendance, resale fields, and publish/co-host metadata.
 * Most calendar logic assumes this model shape is the source of truth.
 */

import mongoose from "mongoose";

// Keep backward compatibility with older records created before
// musicFormat switched from "All" to "Both".
const normalizeMusicFormatForStorage = (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "All" ? "Both" : trimmed;
};

const calendarEventSchema = new mongoose.Schema(
    {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        eventType: {
            type: String,
            enum: ["Social", "Class", "Workshop", "Festival"],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        genres: {
            type: [String],
            default: [],
        },
        musicFormat: {
            type: String,
            enum: ["Both", "DJ", "Live music"],
            default: "Both",
        },
        startDate: {
            type: String,
            required: true,
        },
        startTime: {
            type: String,
            required: true,
        },
        endDate: {
            type: String,
            default: "",
        },
        endTime: {
            type: String,
            default: "",
        },
        venue: {
            type: String,
            trim: true,
            default: "",
            maxlength: 120,
        },
        address: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        city: {
            type: String,
            trim: true,
            default: "",
            maxlength: 120,
        },
        onlineEvent: {
            type: Boolean,
            default: false,
        },
        ticketType: {
            type: String,
            enum: ["prepaid", "door"],
            default: "prepaid",
        },
        freeEvent: {
            type: Boolean,
            default: false,
        },
        minPrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxPrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        fixedPrice: {
            type: Boolean,
            default: false,
        },
        currency: {
            type: String,
            uppercase: true,
            match: [/^[A-Z]{3}$/, "Currency must be a valid 3-letter code"],
            default: "GBP",
        },
        ticketLink: {
            type: String,
            trim: true,
            default: "",
            maxlength: 500,
        },
        allowResell: {
            type: String,
            enum: ["yes", "no"],
            default: "no",
        },
        resellCondition: {
            type: String,
            enum: ["When tickets are sold-out", "Always"],
            default: "When tickets are sold-out",
        },
        resellActivated: {
            type: Boolean,
            default: false,
        },
        onlineLinks: {
            instagram: {
                type: String,
                trim: true,
                default: "",
                maxlength: 500,
            },
            facebook: {
                type: String,
                trim: true,
                default: "",
                maxlength: 500,
            },
            youtube: {
                type: String,
                trim: true,
                default: "",
                maxlength: 500,
            },
            linkedin: {
                type: String,
                trim: true,
                default: "",
                maxlength: 500,
            },
            website: {
                type: String,
                trim: true,
                default: "",
                maxlength: 500,
            },
        },
        coHosts: {
            type: String,
            trim: true,
            default: "",
            maxlength: 200,
        },
        editedAt: {
            type: Date,
            default: null,
        },
        coHostContacts: {
            type: [{
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
                    trim: true,
                    default: "",
                    maxlength: 120,
                },
                avatarUrl: {
                    type: String,
                    trim: true,
                    default: "",
                    maxlength: 500,
                },
            }],
            default: [],
        },
        imageUrl: {
            type: String,
            trim: true,
            default: "",
        },
        imageStorageId: {
            type: String,
            trim: true,
            default: "",
            maxlength: 250,
        },
        attendees: {
            type: [{
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                avatarUrl: {
                    type: String,
                    trim: true,
                    default: "",
                    maxlength: 500,
                },
                resaleTicketCount: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 10,
                },
                resaleVisibility: {
                    type: String,
                    enum: ["anyone", "mutual", "circle"],
                    default: "anyone",
                },
            }],
            default: [],
        },
        publisherType: {
            type: String,
            enum: ["member", "organisation"],
            default: "member",
        },
        publisherOrganisationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organisation",
            default: null,
        },
    },
    { timestamps: true }
);

calendarEventSchema.pre("validate", function normalizeLegacyMusicFormat() {
    // Saving attendees/resell settings re-validates the full document,
    // so normalize legacy enum values before validation runs.
    this.musicFormat = normalizeMusicFormatForStorage(this.musicFormat);
});

export const CalendarEvent = mongoose.model("CalendarEvent", calendarEventSchema, "calendarevents");
