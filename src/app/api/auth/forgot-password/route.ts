import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { Resend } from 'resend';
import { EMAIL_FORM_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend.emails.send({
    from: 'Foodeez <no-reply@foodeez.ch>',
    to,
    subject: 'Reset your Foodeez password',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p><p>This link will expire in 1 hour.</p>`
  });
} 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const limited = await rateLimitResponse(request.headers, 'forgot-password', email, EMAIL_FORM_LIMITS);
    if (limited) return limited;

    // Check if user exists
    const user = await prisma.visitors_account.findUnique({
      where: { EMAIL_ADDRESS: email },
    });

    if (!user) {
      // Return success even if user doesn't exist for security
      return NextResponse.json(
        { message: 'If an account exists, you will receive a password reset email' },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    await prisma.visitors_account.update({
      where: { EMAIL_ADDRESS: email },
      data: {
        RESET_TOKEN: resetToken,
        RESET_TOKEN_EXPIRY: resetTokenExpiry,
      },
    });

    // Generate reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

    // Send reset password email
    await sendPasswordResetEmail(email, resetUrl);

    return NextResponse.json(
      { message: 'If an account exists, you will receive a password reset email' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
} 
