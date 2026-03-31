import mongoose from "mongoose";

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
    },
    { timestamps: true }
);

export const Organisation = mongoose.model("Organisation", organisationSchema, "organisation");
