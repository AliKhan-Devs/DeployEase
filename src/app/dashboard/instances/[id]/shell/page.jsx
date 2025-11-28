"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { io as socketClient } from "socket.io-client";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

export default function LiveShellPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const termRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!session) return;

    const term = new Terminal({
      cursorBlink: true,
      rows: 30,
      cols: 80,
      fontFamily: "monospace",
    });
    term.open(termRef.current);

    const socket = socketClient(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    // Join room and start SSH
    socket.on("connect", () => {
      socket.emit("join-room", session.user.id);
      socket.emit("start-ssh", { instance: { id } });
    });

    // Write SSH output to terminal
    socket.on("ssh-log", (data) => {
      term.write(data);
    });

    // Send user input directly to SSH
    term.onData((data) => {
      socket.emit("ssh-input", data);
    });

    socket.on("disconnect", () => {
      term.write("\r\n🔌 Disconnected from server");
    });

    return () => {
      socket.disconnect();
      term.dispose();
    };
  }, [session, id]);

  return (
    <section className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Live Shell</h1>
      <p className="text-gray-500 text-sm mb-4">
        Connected to deployment ID: <span className="font-mono">{id}</span>
      </p>
      <div
        ref={termRef}
        className="h-[500px] w-full bg-black rounded"
      ></div>
    </section>
  );
}
