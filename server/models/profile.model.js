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
        bio: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },
        jamCircle: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
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
    },
    { timestamps: true }
);

export const Profile = mongoose.model("Profile", profileSchema);
