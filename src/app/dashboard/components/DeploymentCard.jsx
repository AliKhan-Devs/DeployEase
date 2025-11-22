"use client";
import Link from "next/link";

export default function DeploymentCard({ deployment }) {
  const handleDeleteDeployment = (id) => async () => {
    const confirmDelete = confirm(`Are you sure you want to delete this deployment?${id}`);
    if (!confirmDelete) return;

    try {
      await fetch(`/api/deployments/${id}`, { method: "DELETE", body: JSON.stringify({ accessKeyId: 'AKIAX4UILUEPPORQHEHA' , secretAccessKey: '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' , region: 'us-east-1' }) });
    } catch (err) {
      console.error(err);
    }
  };
  const statusColor = {
    SUCCESS: "green",
    FAILED: "red",
    CREATING: "yellow",
    INSTALLING: "blue",
    RUNNING: "green",
  }[deployment.status] || "gray";

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-bold">{deployment.repoName}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
        Branch: {deployment.branch}
      </p>
      <p className={`mt-2 font-semibold text-${statusColor}-600`}>
        Status: {deployment.status}
      </p>
      <p className="mt-1 text-gray-500 text-sm">
        IP: {deployment.ec2PublicIp || "Pending..."}
      </p>

      <Link
        href={`/dashboard/deployments/${deployment.id}`}
        className="mt-4 inline-block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
      >
        See Details
      </Link>
      <Link
        href={`/dashboard/deployments/${deployment.id}/shell`}
        className="mt-4 inline-block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
      >
        Connect
      </Link>

       
    {/* Delete deployment option */}
     <button className="mt-4 inline-block w-full text-center bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
     onClick={handleDeleteDeployment(deployment.id)}
     >
       Delete
     </button>
    </div>
  );
}
