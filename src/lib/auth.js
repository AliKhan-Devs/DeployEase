import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import prisma from "./prisma";

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
    // Runs on sign-in
    async signIn({ user, account, profile }) {
      try {
        const githubId = profile.id?.toString();
        const githubUsername = profile.login;
        const email = user.email || null;

        let existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { githubId }],
          },
        });

        if (existingUser) {
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
        } else {
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
      if (user?.id) {
        token.id = user.id; // DB user ID
      }
      return token;
    },

    // Make DB user id available in session
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id; // DB user ID
      }
      return session;
    },
  },
};
