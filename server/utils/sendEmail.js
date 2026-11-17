import "../env.js";
import nodemailer from "nodemailer";

const createTransporter = () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, "") : "";

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
};

/**
 * Generate a modern, responsive, clinical healthcare HTML email template
 */
export const buildHealthcareEmailTemplate = ({
    subject = "Appointment Notification",
    text = "",
    recipientName = "",
    role = "patient",
    details = null,
    googleCalendarUrl = null,
}) => {
    // Generate detail rows if details object is provided
    let detailsHtml = "";
    if (details && typeof details === "object" && Object.keys(details).length > 0) {
        const rows = Object.entries(details)
            .map(([label, value]) => {
                const isStatus = label.toLowerCase() === "status";
                const displayVal = isStatus
                    ? `<span style="display: inline-block; padding: 3px 10px; font-size: 12px; font-weight: 700; color: #047857; background-color: #d1fae5; border-radius: 9999px; letter-spacing: 0.5px; text-transform: uppercase;">${value}</span>`
                    : `<span style="font-weight: 600; color: #0f172a;">${value}</span>`;

                return `
                <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; width: 35%;">
                        ${label}
                    </td>
                    <td style="padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; width: 65%;">
                        ${displayVal}
                    </td>
                </tr>`;
            })
            .join("");

        detailsHtml = `
        <div style="margin: 24px 0 20px 0;">
            <div style="font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                📋 Appointment Summary
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                ${rows}
            </table>
        </div>`;
    }

    const greeting = recipientName ? `Hello <strong>${recipientName}</strong>,` : "Hello,";
    const headerBadge = role === "doctor" ? "DOCTOR CLINICAL REMINDER" : "PATIENT NOTIFICATION";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #1e293b; line-height: 1.6;">

    <!-- Wrapper Table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 12px;">
        <tr>
            <td align="center">
                
                <!-- Main Container -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #091e3a 0%, #0369a1 100%); padding: 30px 32px; text-align: left;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 700; color: #bae6fd; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                                            ${headerBadge}
                                        </div>
                                        <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0;">
                                            CareScribe <span style="font-weight: 400; color: #7dd3fc;">Clinical AI</span>
                                        </div>
                                        <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px; letter-spacing: 0.2px;">
                                            Advanced Clinical Care & Scribe System
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px;">
                            
                            <!-- Salutation -->
                            <div style="font-size: 16px; color: #334155; margin-bottom: 14px;">
                                ${greeting}
                            </div>

                            <!-- Primary Notice Box -->
                            <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 0 8px 8px 0; padding: 18px 20px; margin-bottom: 20px;">
                                <div style="font-size: 15px; color: #0c4a6e; font-weight: 500; line-height: 1.6;">
                                    ${text}
                                </div>
                            </div>

                            <!-- Structured Details Table -->
                            ${detailsHtml}

                            <!-- 1-Click Google Calendar Action (PATIENTS ONLY) -->
                            ${role === "patient" && googleCalendarUrl ? `
                            <div style="margin: 24px 0 10px 0; padding: 20px; background: #f8fafc; border: 1.5px dashed #bae6fd; border-radius: 12px; text-align: center;">
                                <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                                    📅 Set Google Calendar Reminder
                                </div>
                                <div style="font-size: 12.5px; color: #64748b; margin-bottom: 14px; line-height: 1.5;">
                                    Add this consultation to your Google Calendar to receive automatic phone notifications before your visit.
                                </div>
                                <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff !important; text-decoration: none; font-size: 13.5px; font-weight: 700; padding: 11px 22px; border-radius: 9px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                                    Add to Google Calendar
                                </a>
                            </div>
                            ` : ""}
                        </td>
                    </tr>
                </table>
                <!-- /Main Container -->

            </td>
        </tr>
    </table>

</body>
</html>
    `.trim();
};

/**
 * Utility function to send styled emails via nodemailer
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.text - Fallback plain text / main message
 * @param {string} [options.html] - Optional raw HTML override
 * @param {string} [options.recipientName] - Optional name of recipient
 * @param {string} [options.role] - Optional role ("patient" | "doctor")
 * @param {Object} [options.details] - Optional key-value object of appointment details
 */
export const sendEmail = async ({
    to,
    subject = "CareScribe Notification",
    text = "",
    html = null,
    recipientName = "",
    role = "patient",
    details = null,
    googleCalendarUrl = null,
    icsContent = null,
}) => {
    if (!to) {
        console.log("Email notification skipped: recipient email address is missing.");
        return false;
    }

    try {
        const transporter = createTransporter();

        // Build rich HTML template if custom html is not explicitly passed
        const finalHtml = html || buildHealthcareEmailTemplate({
            subject,
            text,
            recipientName,
            role,
            details,
            googleCalendarUrl,
        });

        const mailOptions = {
            from: `"CareScribe" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html: finalHtml,
        };

        // Attach iCalendar (.ics) invite ONLY for patient emails
        if (role === "patient" && icsContent) {
            mailOptions.icalEvent = {
                filename: "appointment.ics",
                method: "REQUEST",
                content: icsContent,
            };
            mailOptions.attachments = [
                {
                    filename: "appointment.ics",
                    content: icsContent,
                    contentType: "text/calendar; charset=utf-8; method=REQUEST",
                },
            ];
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`✉️ Email successfully sent to ${to} (MessageId: ${info.messageId})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error.message);
        return false;
    }
};
