import mongoose from "mongoose";

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
            enum: ["All", "DJ", "Live music"],
            default: "All",
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
        socialLinks: {
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
            }],
            default: [],
        },
    },
    { timestamps: true }
);

export const CalendarEvent = mongoose.model("CalendarEvent", calendarEventSchema);
