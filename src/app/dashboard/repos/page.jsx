"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, ExternalLink, Cloud, Search } from "lucide-react";
import { motion } from "framer-motion";

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

  // Handle search input
  useEffect(() => {
    const filtered = repos.filter((repo) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRepos(filtered);
  }, [searchTerm, repos]);

  if (loading)
    return <p className="p-6 text-gray-500 text-center">Loading repositories...</p>;
  if (error)
    return <p className="p-6 text-red-500 text-center">Error: {error}</p>;

  return (
    <section className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Your GitHub Projects</h2>

      {/* Search Input */}
      <div className="flex items-center max-w-md w-full gap-2 border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-3">
          <Search size={18} className="text-gray-400 dark:text-gray-300" />
        </div>
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 py-2 px-2 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      {filteredRepos.length === 0 ? (
        <p className="text-gray-600 text-center mt-6">
          No repositories match your search.
        </p>
      ) : (
        <div className="space-y-4">
          {filteredRepos.map((repo, index) => (
            <motion.div
              key={repo.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 rounded-xl p-5 shadow hover:shadow-xl border border-gray-200/50 dark:border-gray-700/50"
            >
              {/* Left: Repo Info */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{repo.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 line-clamp-2">
                  {repo.description || "No description provided"}
                </p>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-300">
                  <span className="flex items-center gap-1">
                    <Star size={16} /> {repo.stargazers_count}
                  </span>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink size={16} /> View Repo
                  </a>
                </div>
              </div>

              {/* Right: Deploy Button */}
              <Link
                href={`/dashboard/repos/${repo.id}?name=${encodeURIComponent(
                  repo.name
                )}&url=${encodeURIComponent(repo.html_url)}`}
                className="mt-4 sm:mt-0 flex items-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Cloud size={16} /> Deploy on AWS
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
