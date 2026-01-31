import { MailtrapClient } from "mailtrap";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.MAILTRAP_API_TOKEN;

const client = new MailtrapClient({
  token: TOKEN,
});

const sender = {
  email: "hello@swinggity.com",
  name: "Mailtrap Test",
};
const recipients = [
  {
    email: "isabelle.m.m.waltrick@gmail.com",
  }
];

client
  .send({
    from: sender,
    to: recipients,
    subject: "You are awesome!",
    text: "Congrats for sending test email with Mailtrap!",
    category: "Integration Test",
  })
  .then(console.log, console.error);