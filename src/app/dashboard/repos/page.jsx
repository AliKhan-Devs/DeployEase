"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, ExternalLink, Cloud, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Loading from "@/app/loading";

export default function ReposPage() {
  const [repos, setRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await fetch("/api/github/repos", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load repositories");

        const data = await res.json();
        if (Array.isArray(data)) {
          setRepos(data);
          setFilteredRepos(data);
        } else setError("Unexpected response format");
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRepos();
  }, []);

  useEffect(() => {
    const filtered = repos.filter((repo) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRepos(filtered);
  }, [searchTerm, repos]);

  if (loading)
    return <Loading message="Loading your GitHub repositories..." />;
  if (error)
    return <p className="p-6 text-red-500 text-center">Error: {error}</p>;

  return (
    <section className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-semibold tracking-tight">Your GitHub Projects</h2>
      </motion.div>

      {/* Search Input */}
      <div className="max-w-md w-full">
        <Input
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />
      </div>

      {filteredRepos.length === 0 ? (
        <p className="text-gray-600 text-center mt-6">
          No repositories match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepos.map((repo, index) => (
            <motion.div
              key={repo.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                  <h3 className="text-lg font-semibold">{repo.name}</h3>
                </CardHeader>

                <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <p className="line-clamp-2">
                    {repo.description || "No description provided"}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <Star size={16} className="text-yellow-500" /> {repo.stargazers_count}
                    </span>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      <ExternalLink size={14} /> View Repo
                    </a>
                  </div>
                </CardContent>

                <CardFooter>
                  <Link
                    href={`/dashboard/repos/${repo.id}?name=${encodeURIComponent(
                      repo.name
                    )}&url=${encodeURIComponent(repo.html_url)}`}
                  >
                    <Button size="sm" className="flex items-center gap-2">
                      <Cloud size={16} /> Deploy on AWS
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
