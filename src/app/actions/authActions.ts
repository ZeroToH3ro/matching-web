'use server';

import { auth, signIn, signOut } from '@/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/mail';
import { prisma } from '@/lib/prisma';
import { LoginSchema } from '@/lib/schemas/LoginSchema';
import { combinedRegisterSchema, ProfileSchema, registerSchema, RegisterSchema } from '@/lib/schemas/RegisterSchema';
import { generateToken, getTokenByToken } from '@/lib/tokens';
import { ActionResult } from '@/types';
import { TokenType, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';

export async function signInUser(data: LoginSchema): Promise<ActionResult<string>> {
    try {
        const existingUser = await getUserByEmail(data.email);

        if (!existingUser || !existingUser.email) return { status: 'error', error: 'Invalid credentials' }

        if (!existingUser.emailVerified) {
            const { token, email } = await generateToken(existingUser.email, TokenType.VERIFICATION);

            const emailResult = await sendVerificationEmail(email, token);
            
            if (!emailResult.success) {
                console.error('Failed to send verification email:', emailResult.error);
                return { status: 'error', error: 'Failed to send verification email. Please try again.' }
            }

            return { status: 'error', error: 'Please verify your email before logging in' }
        }

        await signIn('credentials', {
            email: data.email,
            password: data.password,
            redirect: false
        });

        return { status: 'success', data: 'Logged in' }
    } catch (error) {
        console.log(error);
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return { status: 'error', error: 'Invalid credentials' }
                default:
                    return { status: 'error', error: 'Something went wrong' }
            }
        } else {
            return { status: 'error', error: 'Something else went wrong' }
        }
    }
}

export async function signOutUser() {
    await signOut({ redirectTo: '/' });
}

export async function registerUser(data: RegisterSchema): Promise<ActionResult<User>> {
    try {
        const validated = combinedRegisterSchema.safeParse(data);

        if (!validated.success) {
            return { status: 'error', error: validated.error.errors }
        }

        const { name, email, password, gender, description, city, country, dateOfBirth, } = validated.data;

        const hashedPassword = await bcrypt.hash(password, 10);

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) return { status: 'error', error: 'User already exists' };

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                profileComplete: true,
                member: {
                    create: {
                        name,
                        description,
                        city,
                        country,
                        dateOfBirth: new Date(dateOfBirth),
                        gender
                    }
                }
            }
        })

        const verificationToken = await generateToken(email, TokenType.VERIFICATION);

        const emailResult = await sendVerificationEmail(verificationToken.email, verificationToken.token);
        
        if (!emailResult.success) {
            console.error('Failed to send verification email:', emailResult.error);
            // Still return success for user creation, but log the email failure
            console.log('User created successfully but verification email failed to send');
        }

        return { status: 'success', data: user }
    } catch (error) {
        console.log(error);
        return { status: 'error', error: 'Something went wrong' }
    }

}

export async function verifyEmail(token: string): Promise<ActionResult<string>> {
    try {
        const existingToken = await getTokenByToken(token);

        if (!existingToken) {
            return { status: 'error', error: 'Invalid token' }
        }

        const hasExpired = new Date() > existingToken.expires;

        if (hasExpired) {
            return { status: 'error', error: 'Token has expired' }
        }

        const existingUser = await getUserByEmail(existingToken.email);

        if (!existingUser) {
            return { status: 'error', error: 'User not found' }
        }

        await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() }
        });

        await prisma.token.delete({ where: { id: existingToken.id } })

        return { status: 'success', data: 'Success' }

    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function generateResetPasswordEmail(email: string): Promise<ActionResult<string>> {
    try {
        const existingUser = await getUserByEmail(email);

        if (!existingUser) {
            return { status: 'error', error: 'Email not found' }
        }

        const token = await generateToken(email, TokenType.PASSWORD_RESET);

        const emailResult = await sendPasswordResetEmail(token.email, token.token);
        
        if (!emailResult.success) {
            console.error('Failed to send password reset email:', emailResult.error);
            return { status: 'error', error: 'Failed to send password reset email. Please try again.' }
        }

        return { status: 'success', data: 'Password reset email has been sent.  Please check your emails' }
    } catch (error) {
        console.log(error);
        return { status: 'error', error: 'Something went wrong' }
    }
}

export async function getUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
}

export async function getAuthUserId() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) throw new Error('Unauthorized');

    return userId;
}

export async function resetPassword(password: string, token: string | null): Promise<ActionResult<string>> {
    try {
        if (!token) return { status: 'error', error: 'Missing token' };

        const existingToken = await getTokenByToken(token);

        if (!existingToken) {
            return { status: 'error', error: 'Invalid token' }
        }

        const hasExpired = new Date() > existingToken.expires;

        if (hasExpired) {
            return { status: 'error', error: 'Token has expired' }
        }

        const existingUser = await getUserByEmail(existingToken.email);

        if (!existingUser) {
            return { status: 'error', error: 'User not found' }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: existingUser.id },
            data: { passwordHash: hashedPassword }
        });

        await prisma.token.delete({
            where: { id: existingToken.id }
        });

        return { status: 'success', data: 'Password updated successfully.  Please try logging in' }
    } catch (error) {
        console.log(error);
        return { status: 'error', error: 'Something went wrong' }
    }
}

export async function completeSocialLoginProfile(data: ProfileSchema):
    Promise<ActionResult<string>> {

    const session = await auth();

    if (!session?.user) return { status: 'error', error: 'User not found' };

    try {
        const existingUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { 
                member: true,
                accounts: {
                    select: {
                        provider: true
                    }
                }
            }
        });

        if (!existingUser) {
            return { status: 'error', error: 'User not found' };
        }

        if (existingUser.member) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    profileComplete: true,
                    member: {
                        update: {
                            name: session.user.name as string,
                            image: session.user.image,
                            gender: data.gender,
                            dateOfBirth: new Date(data.dateOfBirth),
                            description: data.description,
                            city: data.city,
                            country: data.country,
                            updated: new Date()
                        }
                    }
                }
            });
        } else {
            // Create new member
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    profileComplete: true,
                    member: {
                        create: {
                            name: session.user.name as string,
                            image: session.user.image,
                            gender: data.gender,
                            dateOfBirth: new Date(data.dateOfBirth),
                            description: data.description,
                            city: data.city,
                            country: data.country
                        }
                    }
                }
            });
        }

        return { status: 'success', data: existingUser.accounts[0]?.provider || 'unknown' }
    } catch (error) {
        console.log(error);
        return { status: 'error', error: 'Something went wrong while completing profile' };
    }
}

export async function getUserRole() {
    const session = await auth();

    const role = session?.user.role;

    if (!role) throw new Error('Not in role');

    return role;
}