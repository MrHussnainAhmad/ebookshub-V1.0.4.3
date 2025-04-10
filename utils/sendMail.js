// utils/sendMail.js
import nodemailer from "nodemailer";

const sendMail = async (email, subject, text) => {
  try {
    // Create a Gmail SMTP transport
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "ebooks.hub.live@gmail.com",
        pass: "ksykizloaxyaxvva" // App password, no spaces
      }
    });

    // Send the email
    const info = await transporter.sendMail({
      from: '"eBooksHub" <ebooks.hub.live@gmail.com>',
      to: email,
      subject: subject,
      text: text,
    });

    console.log("Email sent successfully to", email);
    console.log("Message ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export default sendMail;
