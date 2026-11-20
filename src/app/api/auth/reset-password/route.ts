import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { token, password } = await req.json();

        // Objects would become Prisma filters (e.g. { not: "" }) and match any pending reset.
        if (typeof token !== 'string' || !token || typeof password !== 'string' || password.length < 8) {
            return NextResponse.json(
                { message: 'A valid token and a password of at least 8 characters are required' },
                { status: 400 }
            );
        }

        // Find user with valid reset token
        const user = await prisma.visitors_account.findFirst({
            where: {
                RESET_TOKEN: token,
                RESET_TOKEN_EXPIRY: {
                    gt: new Date(),
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { message: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update user's password and clear reset token
        await prisma.visitors_account.update({
            where: { VISITORS_ACCOUNT_ID: user.VISITORS_ACCOUNT_ID },
            data: {
                PASSWORD: hashedPassword,
                RESET_TOKEN: null,
                RESET_TOKEN_EXPIRY: null,
            },
        });

        return NextResponse.json(
            { message: 'Password reset successful' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { message: 'Error resetting password' },
            { status: 500 }
        );
    }
} 