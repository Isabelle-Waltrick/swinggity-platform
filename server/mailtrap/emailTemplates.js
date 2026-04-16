// Code used and adapted from https://github.com/burakorkmez/mern-advanced-auth/blob/master/backend/mailtrap/emailTemplates.js

export const VERIFICATION_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Verify Your Email</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p>Thank you for signing up! Your verification code is:</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #FF6699;">{verificationCode}</span>
    </div>
    <p>Enter this code on the verification page to complete your registration.</p>
    <p>This code will expire in 15 minutes for security reasons.</p>
    <p>If you didn't create an account with us, please ignore this email.</p>
    <p>Best regards,<br>Swinggity Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;

export const PASSWORD_RESET_SUCCESS_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #FF6699)); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Password Reset Successful</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p>We're writing to confirm that your password has been successfully reset.</p>
    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #FF6699; color: white; width: 50px; height: 50px; line-height: 50px; border-radius: 50%; display: inline-block; font-size: 30px;">
        ✓
      </div>
    </div>
    <p>If you did not initiate this password reset, please contact our support team immediately.</p>
    <p>For security reasons, we recommend that you:</p>
    <ul>
      <li>Use a strong, unique password</li>
      <li>Enable two-factor authentication if available</li>
      <li>Avoid using the same password across multiple sites</li>
    </ul>
    <p>Thank you for helping us keep your account secure.</p>
    <p>Best regards,<br>Swinggity Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;

export const PASSWORD_RESET_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #FF6699); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Password Reset</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p>We received a request to reset your password. If you didn't make this request, please ignore this email.</p>
    <p>To reset your password, click the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{resetURL}" style="background-color: #FF6699; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
    </div>
    <p>This link will expire in 1 hour for security reasons.</p>
    <p>Best regards,<br>Swinggity Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;

export const JAM_CIRCLE_INVITE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You were invited to a Jam Circle</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">You're Invited to a Jam Circle</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p><strong>{inviterName}</strong> invited you to join their Jam Circle on Swinggity.</p>
    <div style="text-align: center; margin: 24px 0;">
      <img src="{inviterAvatarUrl}" alt="{inviterName}" style="width: 92px; height: 92px; border-radius: 50%; border: 3px solid #FF6699; object-fit: cover; background: #fff;" />
      <p style="margin: 10px 0 0; font-weight: bold; color: #FF6699;">{inviterName}</p>
    </div>
    <p>Would you like to accept this invitation?</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{acceptUrl}" style="display: inline-block; background-color: #FF6699; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">Accept</a>
      <a href="{denyUrl}" style="display: inline-block; background-color: #ffffff; color: #333; border: 1px solid #ccc; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Deny</a>
    </div>
    <p>This invitation will expire in 7 days.</p>
    <p>Best regards,<br>Swinggity Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;

export const ORGANISER_VERIFICATION_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Organiser Verification Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Organiser Verification Request</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello Swinggity Team,</p>
    <p>A user asked to be verified as an organiser.</p>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">User</h2>
    <p style="margin: 0;"><strong>{requesterName}</strong></p>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Message</h2>
    <div style="background: #ffffff; border: 1px solid #f0d6e3; border-radius: 6px; padding: 14px; white-space: normal;">
      {requesterMessage}
    </div>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Contact Details</h2>
    <ul style="padding-left: 18px; margin: 0;">
      {contactMethods}
    </ul>

    <p style="margin-top: 24px;">Best regards,<br>Swinggity Platform</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message generated from the Calendar organiser request form.</p>
  </div>
</body>
</html>
`;

export const MEMBER_CONTACT_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Swinggity Contact Message</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">You Have a New Contact Message</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello {recipientName},</p>
    <p><strong>{senderName}</strong> sent you a message on Swinggity.</p>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Message</h2>
    <div style="background: #ffffff; border: 1px solid #f0d6e3; border-radius: 6px; padding: 14px; white-space: normal;">
      {senderMessage}
    </div>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">How To Contact {senderName}</h2>
    <ul style="padding-left: 18px; margin: 0;">
      {contactMethods}
    </ul>

    <p style="margin-top: 24px;">Best regards,<br>Swinggity Platform</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message generated from the Swinggity contact form.</p>
  </div>
</body>
</html>
`;

export const CO_HOST_INVITE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Co-host Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Co-host Invitation</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p><strong>{inviterName}</strong> invited <strong>{coHostDisplayName}</strong> to be a co-host for the event <strong>{eventTitle}</strong>.</p>
    <div style="text-align: center; margin: 24px 0;">
      <img src="{inviterAvatarUrl}" alt="{inviterName}" style="width: 92px; height: 92px; border-radius: 50%; border: 3px solid #FF6699; object-fit: cover; background: #fff;" />
      <p style="margin: 10px 0 0; font-weight: bold; color: #FF6699;">{inviterName}</p>
    </div>
    <p>If you accept, your contact will be shown on the event overview as a co-host.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{acceptUrl}" style="display: inline-block; background-color: #FF6699; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">Accept</a>
      <a href="{denyUrl}" style="display: inline-block; background-color: #ffffff; color: #333; border: 1px solid #ccc; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Deny</a>
    </div>
    <p>This invitation will expire in 7 days.</p>
    <p>Best regards,<br>Swinggity Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;

export const ORGANISATION_PARTICIPANT_INVITE_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organisation Participant Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Organisation Invitation</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p><strong>{inviterName}</strong> invited you to become a participant of <strong>{organisationName}</strong>.</p>
    <div style="text-align: center; margin: 24px 0;">
      <img src="{inviterAvatarUrl}" alt="{inviterName}" style="width: 92px; height: 92px; border-radius: 50%; border: 3px solid #FF6699; object-fit: cover; background: #fff;" />
      <p style="margin: 10px 0 0; font-weight: bold; color: #FF6699;">{inviterName}</p>
    </div>
    <p>If you accept, this organisation will appear on your profile and you can leave it any time.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{acceptUrl}" style="display: inline-block; background-color: #FF6699; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">Accept</a>
      <a href="{denyUrl}" style="display: inline-block; background-color: #ffffff; color: #333; border: 1px solid #ccc; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Deny</a>
    </div>
    <p>This invitation will expire in 7 days.</p>
    <p>Best regards,<br>Swinggity Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;

export const PROFILE_REPORT_ALERT_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Profile Report</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Profile Flag Submitted</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello Swinggity Admin Team,</p>
    <p>A member submitted a profile flag report.</p>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Reporter</h2>
    <ul style="padding-left: 18px; margin: 0;">
      <li><strong>Name:</strong> {reporterName}</li>
      <li><strong>Email:</strong> {reporterEmail}</li>
      <li><strong>User ID:</strong> {reporterUserId}</li>
    </ul>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Reported Profile</h2>
    <ul style="padding-left: 18px; margin: 0;">
      <li><strong>Name:</strong> {reportedMemberName}</li>
      <li><strong>Email:</strong> {reportedMemberEmail}</li>
      <li><strong>User ID:</strong> {reportedMemberUserId}</li>
    </ul>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Reasons</h2>
    <ul style="padding-left: 18px; margin: 0;">
      {reasons}
    </ul>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Additional Details</h2>
    <div style="background: #ffffff; border: 1px solid #f0d6e3; border-radius: 6px; padding: 14px; white-space: pre-wrap;">
      {additionalDetails}
    </div>

    <p style="margin-top: 24px;">Best regards,<br>Swinggity Platform</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message generated from a profile flag report.</p>
  </div>
</body>
</html>
`;

export const ADMIN_FEEDBACK_ALERT_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Platform Feedback</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #FF6699, #ee80a4); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Platform Feedback Submitted</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello Swinggity Admin Team,</p>
    <p>A member submitted feedback from the dashboard welcome page.</p>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Member Details</h2>
    <ul style="padding-left: 18px; margin: 0;">
      <li><strong>Name:</strong> {reporterName}</li>
      <li><strong>Email:</strong> {reporterEmail}</li>
      <li><strong>User ID:</strong> {reporterUserId}</li>
    </ul>

    <h2 style="font-size: 18px; margin: 20px 0 8px; color: #FF6699;">Message</h2>
    <div style="background: #ffffff; border: 1px solid #f0d6e3; border-radius: 6px; padding: 14px; white-space: pre-wrap;">
      {feedbackMessage}
    </div>

    <p style="margin-top: 24px;">Best regards,<br>Swinggity Platform</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message generated from the Swinggity feedback popup.</p>
  </div>
</body>
</html>
`;
