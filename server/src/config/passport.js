import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:3000/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                const googleId = profile.id;

                // Check for existing user by Google ID or Email
                let user = await prisma.user.findFirst({
                    where: {
                        OR: [{ googleId: googleId }, { email: email }],
                    },
                });

                const adminEmail = 'giakomogcs@gmail.com';
                const role = email === adminEmail ? 'ADMIN' : 'USER';

                if (!user) {
                    // Create new user
                    user = await prisma.user.create({
                        data: {
                            googleId: googleId,
                            email: email,
                            name: profile.displayName,
                            avatarUrl: profile.photos[0]?.value,
                            role: role,
                            // Ensure admin gets default limits if we were to customize, but defaults are fine
                        },
                    });
                } else {
                    // Update existing user
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            googleId: googleId, // Link google ID if matching by email
                            name: profile.displayName,
                            avatarUrl: profile.photos[0]?.value,
                            // If it's the specific admin email, ensure role is ADMIN (self-healing)
                            role: email === adminEmail ? 'ADMIN' : user.role,
                        },
                    });
                }

                if (!user.isActive) {
                    return done(null, false, { message: 'Account is deactivated.' });
                }

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

export default passport;
