import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './prisma';
import { User } from '@prisma/client';

// IMPORTANT: Make sure to set these environment variables in your .env file
// GOOGLE_CLIENT_ID=your-google-client-id
// GOOGLE_CLIENT_SECRET=your-google-client-secret
// GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback (or your production URL)

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find an existing account with the Google profile ID
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: profile.id,
            },
          },
          include: { user: true },
        });

        if (existingAccount) {
          return done(null, existingAccount.user);
        }

        // If no account exists, find or create a user based on the email
        const user = await prisma.user.upsert({
          where: { email: profile.emails?.[0].value },
          update: {
            name: profile.displayName,
            image: profile.photos?.[0].value,
          },
          create: {
            email: profile.emails?.[0].value,
            name: profile.displayName,
            image: profile.photos?.[0].value,
            emailVerified: new Date(), // Mark email as verified since it comes from Google
            accounts: {
              create: {
                provider: 'google',
                providerAccountId: profile.id,
                type: 'oauth',
                access_token: accessToken,
                refresh_token: refreshToken,
              },
            },
          },
        });

        // If the user was found but didn't have a Google account, link it
        const userHasGoogleAccount = await prisma.account.findFirst({
            where: { userId: user.id, provider: 'google' }
        });

        if (!userHasGoogleAccount) {
            await prisma.account.create({
                data: {
                    userId: user.id,
                    provider: 'google',
                    providerAccountId: profile.id,
                    type: 'oauth',
                    access_token: accessToken,
                    refresh_token: refreshToken,
                }
            });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

// These are not needed for JWT-based sessions, but passport requires them.
passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) { 
    done(error as Error, null);
  }
});

export default passport;
