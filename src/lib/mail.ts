import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

export async function sendVerificationEmail(email: string, token: string) {
    const link = `${baseUrl}/verify-email?token=${token}`;
    console.log(`Link: ${link}`);
    
    try {
        const result = await resend.emails.send({
            from: 'testing@resend.dev',
            to: email,
            subject: 'Verify your email address',
            html: `
                <h1>Verify your email address</h1>
                <p>Click the link below to verify your email address</p>
                <a href="${link}">Verify email</a>
            `
        });

        if (result.error) {
            console.error('Failed to send verification email:', result.error);
            return { success: false, error: result.error };
        }

        console.log('Verification email sent successfully:', result.data);
        return { success: true, data: result.data };
    } catch (error) {
        console.error('Error sending verification email:', error);
        return { success: false, error: error };
    }
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const link = `${baseUrl}/reset-password?token=${token}`;

    try {
        const result = await resend.emails.send({
            from: 'testing@resend.dev',
            to: email,
            subject: 'Reset your password',
            html: `
                <h1>You have requested to reset your password</h1>
                <p>Click the link below to reset password</p>
                <a href="${link}">Reset password</a>
            `
        });

        if (result.error) {
            console.error('Failed to send password reset email:', result.error);
            return { success: false, error: result.error };
        }

        console.log('Password reset email sent successfully:', result.data);
        return { success: true, data: result.data };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return { success: false, error: error };
    }
}