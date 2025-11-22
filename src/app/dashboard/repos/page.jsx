"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ReposPage() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await fetch("/api/github/repos", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load repositories");

        const data = await res.json();
        if (Array.isArray(data)) setRepos(data);
        else setError("Unexpected response format");
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadRepos();
  }, []);

  if (loading) return <p className="p-6 text-gray-500">Loading repositories...</p>;
  if (error) return <p className="p-6 text-red-500">Error: {error}</p>;

  return (
    <section className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Your GitHub Projects</h2>
      {repos.length === 0 ? (
        <p className="text-gray-600">No repositories found.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold">{repo.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
                {repo.description || "No description provided"}
              </p>
              <div className="mt-3 flex justify-between text-sm text-gray-500">
                <span>⭐ {repo.stargazers_count}</span>
                <a
                  href={repo.html_url}
                  target="_blank"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Repo →
                </a>
              </div>

              <Link
                href={`/dashboard/repos/${repo.id}?name=${encodeURIComponent(repo.name)}&url=${encodeURIComponent(repo.html_url)}`}
                className="mt-4 block w-full bg-blue-600 text-center text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Deploy on AWS 🚀
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
