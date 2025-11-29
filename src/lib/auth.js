import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import prisma from "./prisma";

// Redis imports
import { getRedisClient } from "./redis/client";
const redis = getRedisClient();

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        const githubId = profile.id?.toString();
        const githubUsername = profile.login;
        const email = user.email || null;

        // ==============================
        // 1️⃣ Try to get user from Redis cache
        // ==============================
        const cacheKey = `user:${email || githubId}`;
        let existingUser = await redis.get(cacheKey);

        if (existingUser) {
          console.log("User found in Redis cache");
          existingUser = JSON.parse(existingUser);
        } else {
          console.log("user not foun in cache")
          // Fetch from DB if not in cache
          existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { githubId }] },
          });

          if (!existingUser) {
            // Create new user
            existingUser = await prisma.user.create({
              data: {
                email,
                name: user.name,
                image: user.image,
                githubId,
                githubUsername,
              },
            });
          } else {
            // Update user info
            existingUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: user.name,
                image: user.image,
                githubId,
                githubUsername,
              },
            });
          }

          // Store in Redis for next sign-in (TTL: 1 hour)
          await redis.set(cacheKey, JSON.stringify(existingUser), "EX", 3600);
        }

        // ✅ Save DB user id in JWT token
        user.id = existingUser.id;
        return true;
      } catch (err) {
        console.error("Prisma user sync error:", err);
        return false;
      }
    },

    // Include DB user id in JWT
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },

    // Make DB user id available in session
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      return session;
    },
  },
};
