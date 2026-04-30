// Code adapted from Mailtrap documentation: https://mailtrap.io/docs/sending-emails-with-mailtrap-nodejs-sdk

import { MailtrapClient } from "mailtrap";
import dotenv from "dotenv";

dotenv.config();

// GSR11 + GSR12: MAILTRAP_API_TOKEN is read from the environment — not hardcoded.
// Locally sourced from the gitignored .env file; on Render injected via platform config.
const TOKEN = process.env.MAILTRAP_API_TOKEN;

export const mailtrapClient = new MailtrapClient({
  token: TOKEN,
});


export const sender = {
  email: "no-reply@swinggity.com",
  name: "Swinggity Support",
};