"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Loading from "@/app/loading";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAWS, setShowAWS] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [awsId, setAwsId] = useState("");
  const [awsSecret, setAwsSecret] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();

        setUser(data);
        setName(data.name || "");
        setImage(data.image || "");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function saveChanges() {
    setSaving(true);
    try {
      const payload = {
        name,
        image,
      };

      if (awsId) payload.awsAccessKeyId = awsId;
      if (awsSecret) payload.awsSecretAccessKey = awsSecret;

      const res = await fetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const updated = await res.json();
      setUser(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading message="Loading your settings..." />;

  return (
    <section className="p-6 space-y-6">
      <motion.h2
        className="text-2xl font-semibold tracking-tight"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        User Settings
      </motion.h2>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <h3 className="text-lg font-medium">Profile Information</h3>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Profile image */}
            <div className="flex items-center gap-4">
              <Image
                src={image || "/placeholder.png"}
                alt="Profile"
                width={70}
                height={70}
                className="rounded-full border"
              />
              <Input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Profile Image URL"
              />
            </div>

            {/* Name */}
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Email
              </label>
              <Input disabled value={user.email || "No email provided"} />
            </div>

            {/* GitHub */}
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">
                GitHub Username
              </label>
              <Input disabled value={user.githubUsername || ""} />
            </div>

            {/* AWS Credentials */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">AWS Credentials</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAWS(!showAWS)}
                >
                  {showAWS ? "Hide" : "Manage"}
                </Button>
              </div>

              {showAWS && (
                <motion.div
                  className="space-y-4 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">
                      AWS Access Key ID
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter AWS Access Key ID"
                      value={awsId}
                      onChange={(e) => setAwsId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">
                      AWS Secret Access Key
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter AWS Secret"
                      value={awsSecret}
                      onChange={(e) => setAwsSecret(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-end">
            <Button onClick={saveChanges} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </section>
  );
}
