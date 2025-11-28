"use client";
import { useEffect, useState, useRef } from "react";

const stages = [
  {
    title: "Deployment Logs",
    logs: [
      "> Starting deployment...",
      "> Creating EC2 instance...",
      "> Cloning repository...",
      "> Installing dependencies...",
      "> Configuring Nginx reverse proxy...",
      "> Writing environment variables...",
      "> Your app is live at: http://3.21.xx.xx/myapp",
    ],
  },
  {
    title: "Volume Resize Logs",
    logs: [
      "> Increase Volume Workflow started",
      "> Describing instance...",
      "> Root volume found",
      "> Requesting volume resize...",
      "> Volume resize reflected",
      "> Volume modified successfully on AWS",
      "> Filesystem successfully expanded",
    ],
  },
  {
    title: "Auto-Scaling Logs",
    logs: [
      "> Auto-Scaling: starting workflow...",
      "> Using name prefix: my-app",
      "> Instance described successfully",
      "> Creating Launch Template...",
      "> Launch Template created",
      "> Creating Target Group...",
      "> Target Group created",
      "> Creating Load Balancer...",
      "> Load Balancer created",
      "> Creating Listener...",
      "> Listener created",
      "> Creating Auto Scaling Group...",
      "> Auto Scaling Group created",
      "> Auto Scaling Enabled! Public URL: http://myapp.aws.com",
    ],
  },
];

export default function TerminalAnimation() {
  const [currentStage, setCurrentStage] = useState(0);
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const terminalRef = useRef(null);

  useEffect(() => {
    const logs = stages[currentStage].logs;
    let index = 0;

    function typeNext() {
      if (index < logs.length) {
        setDisplayedLogs((prev) => [...prev, logs[index]]);
        index++;
        setTimeout(() => {
          if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }, 50);
        setTimeout(typeNext, 600);
      } else {
        setTimeout(() => {
          setDisplayedLogs([]);
          setCurrentStage((prev) => (prev + 1) % stages.length);
        }, 2000);
      }
    }

    typeNext();
  }, [currentStage]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <div className="font-bold mb-2 text-lg text-black">{stages[currentStage].title}</div>
      <div
        ref={terminalRef}
        className="bg-black text-green-400 font-mono p-4 rounded-xl shadow-lg h-64 overflow-y-auto scrollbar-hide"
      >
        {displayedLogs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
        <span className="blink">|</span>
      </div>

      <style jsx>{`
        .blink {
          display: inline-block;
          animation: blink 1s step-start infinite;
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
