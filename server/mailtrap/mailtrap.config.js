import { MailtrapClient } from "mailtrap";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.MAILTRAP_API_TOKEN;

export const mailtrapClient = new MailtrapClient({
  token: TOKEN,
});


export const sender = {
  email: "no-reply@swinggity.com",
  name: "Swinggity Support",
};