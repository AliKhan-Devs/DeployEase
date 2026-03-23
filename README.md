<div align="center">

# 🚀 DeployEase

### AWS Deployment Automation Platform

**Deploy any GitHub repository to AWS in minutes — no DevOps expertise required.**

[![Demo](https://img.shields.io/badge/▶%20Watch%20Demo-LinkedIn-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/posts/alikhan-devs_deployease-aws-ec2-ugcPost-7403154423637676033-hqyO?utm_source=share&utm_medium=member_desktop&rcm=ACoAAFAzhGYB1ErGHnM-T8Ma5tdEpEkc07cH6nQ)
[![GitHub](https://img.shields.io/badge/GitHub-AliKhan--Devs-181717?style=for-the-badge&logo=github)](https://github.com/AliKhan-Devs)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

![DeployEase Hero](./public/deployease-herosection.JPG)

</div>

---

## 🧠 The Problem

Deploying a Node.js or React app to AWS involves a painful sequence of manual steps: provisioning EC2 instances, configuring security groups, setting up Nginx as a reverse proxy, installing runtime dependencies, managing environment variables, and generating public URLs. For developers, students, and small teams, this friction is a real barrier.

**DeployEase eliminates that friction.** You connect your GitHub account, pick a repository, and the platform handles everything — from EC2 provisioning to Nginx configuration to live SSH access — through a clean dashboard.

---

## 📺 Demo

> 🎬 **[Watch the full walkthrough on LinkedIn](https://www.linkedin.com/in/alikhan-devs/)** — covers one-click deployment, live SSH terminal, auto-scaling, and the MCP server for AI agents.

![Architecture](./public/archetecture.png)

---

## ✨ Features

### Core Deployment
| Feature | Description |
|---|---|
| **One-Click Deploy** | Connect a GitHub repo and deploy to EC2 with a single click |
| **Automated EC2 Provisioning** | Provisions instances, installs runtime (Node.js etc.), sets up env vars automatically |
| **Dynamic Nginx Config** | Hosts multiple apps on one instance under unique slugs — no port conflicts |
| **Public URL Generation** | Instantly accessible URLs, no manual DNS or server config required |
| **GitHub OAuth** | Secure login and repository access via GitHub OAuth |

### Infrastructure Management
| Feature | Description |
|---|---|
| **Live SSH Terminal** | Browser-based terminal (node-pty + WebSocket) for in-dashboard debugging |
| **AWS Load Balancer** | Distributes HTTP/HTTPS traffic across instances via AWS ALB |
| **Auto-Scaling** | Automatically scales EC2 instances based on resource usage |
| **Volume Expansion** | Increase EBS volume of any running instance directly from the dashboard |
| **Deployment Dashboard** | View, manage, and delete all deployments with real-time status |

### AI Agent Integration (MCP Server)
| Feature | Description |
|---|---|
| **MCP Server** | Model Context Protocol server that exposes DeployEase as a tool for AI agents |
| **Natural Language Deployments** | AI agents can deploy repos, scale apps, and manage infra via natural language |
| **Programmatic Control** | Full deployment lifecycle accessible through the MCP tool interface |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DeployEase Platform                       │
│                                                                   │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │   Next.js    │────▶│          Node.js / Express           │  │
│  │   Dashboard  │◀────│              API Server              │  │
│  └──────────────┘     └────────┬─────────────┬───────────────┘  │
│                                │             │                   │
│                    ┌───────────▼──┐   ┌──────▼──────────────┐  │
│                    │  AWS SDK v3  │   │   Socket.IO Server   │  │
│                    │  (EC2, ALB,  │   │  (Live SSH Terminal) │  │
│                    │  Auto Scale) │   └─────────────────────┘  │
│                    └───────────┬──┘                             │
│                                │                                │
│              ┌─────────────────┼─────────────────┐             │
│              │                 │                 │             │
│     ┌────────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐     │
│     │   EC2 Pool    │  │  AWS ALB     │  │  Auto Scale  │     │
│     │  (Nginx +     │  │  (Traffic    │  │   Group      │     │
│     │   node-pty)   │  │   Routing)   │  │              │     │
│     └───────────────┘  └──────────────┘  └─────────────┘     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    MCP Server                             │  │
│  │         (AI Agent Interface — deploy, scale, manage)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Deployment Flow:**
```
User selects repo → GitHub API fetches code → EC2 instance provisioned
→ Bash scripts run (install deps, set env vars, start app with systemd)
→ Nginx configured with unique slug → Public URL returned to dashboard
→ WebSocket connection established for live SSH access
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js, React, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, Express, AWS SDK v3 |
| **Database** | PostgreSQL (Prisma ORM) |
| **Real-time** | Socket.IO, node-pty (SSH terminal over WebSocket) |
| **Cloud** | AWS EC2, AWS ALB, AWS Auto Scaling Groups, EBS |
| **Auth** | GitHub OAuth |
| **Provisioning** | Bash scripts + systemd on EC2 |
| **AI Interface** | Model Context Protocol (MCP) SDK |

---

## ⚙️ Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL (local or cloud)
- AWS account with EC2, ALB, and Auto Scaling permissions
- GitHub OAuth app credentials

### 1. Clone the repository
```bash
git clone https://github.com/AliKhan-Devs/DeployEase.git
cd DeployEase
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root:

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/deployease

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# AWS
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_KEY_PAIR_NAME=your_ec2_keypair_name
AWS_SECURITY_GROUP_ID=your_security_group_id
AWS_SUBNET_ID=your_subnet_id

# Session
SESSION_SECRET=your_session_secret
```

### 4. Run Prisma migrations
```bash
npx prisma migrate dev
```

### 5. Start the application
```bash
# Start the main app
npm run dev

# Start the Socket server (separate terminal)
node socketServer.js
```

App runs at `http://localhost:3000`

---

## 🤖 MCP Server Setup

The MCP server lets AI agents (Claude, GPT, etc.) deploy and manage infrastructure through natural language.

```bash
cd mcp-server
npm install
npm start
```

**Available MCP Tools:**
```
deploy_repository     → Deploy a GitHub repo to EC2
scale_application     → Add/remove instances from Auto Scaling Group
increase_volume       → Expand EBS storage on a running instance
list_deployments      → Get all active deployments
get_deployment_status → Check health and status of a specific deployment
```

---

## 📁 Project Structure

```
DeployEase/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── api/
│   │   │   ├── auth/           # GitHub OAuth handlers
│   │   │   ├── deployments/    # Deploy, delete, list endpoints
│   │   │   ├── ec2/            # EC2 provisioning & scaling
│   │   │   └── load-balancer/  # ALB configuration
│   │   └── dashboard/          # Dashboard UI pages
│   ├── components/             # Reusable React components
│   └── lib/
│       ├── aws/                # AWS SDK v3 helpers (EC2, ALB, ASG)
│       ├── prisma/             # Database client
│       └── provisioning/       # Bash script templates
├── prisma/
│   └── schema.prisma           # Database schema
├── mcp-server/                 # MCP server for AI agent integration
├── socketServer.js             # Socket.IO + node-pty SSH bridge
├── public/                     # Static assets & screenshots
└── tests/                      # Test suites
```

---

## 🗺️ Roadmap

- [ ] **Health Checks & Monitoring** — Detect unhealthy instances, visual CPU/memory metrics on dashboard
- [ ] **HTTPS/SSL** — Automatic TLS via Let's Encrypt
- [ ] **CI/CD Trigger** — Auto-deploy on GitHub push / merge events
- [ ] **Rollback Support** — Maintain deployment versions, one-click revert
- [ ] **Docker Support** — Deploy containerized apps via Docker
- [ ] **Cost Estimation** — Real-time AWS cost display per deployment
- [ ] **S3 Deployment Target** — Option to deploy static apps to S3 instead of EC2
- [ ] **Local File Upload** — Deploy apps without a GitHub repo

---

## 🔐 Security Notes

- AWS credentials are stored as environment variables only — never committed to the repository
- GitHub OAuth tokens are scoped to repo read access
- EC2 instances are isolated in a dedicated security group
- SSH access is proxied through the backend — private keys never leave the server

---

## 👨‍💻 Author

**Ali Khan** — Backend Engineer | AWS | Node.js | Distributed Systems

[![LinkedIn](https://img.shields.io/badge/LinkedIn-alikhan--devs-0A66C2?style=flat&logo=linkedin)](https://www.linkedin.com/in/alikhan-devs/)
[![GitHub](https://img.shields.io/badge/GitHub-AliKhan--Devs-181717?style=flat&logo=github)](https://github.com/AliKhan-Devs)
[![Email](https://img.shields.io/badge/Email-alikhandevs@gmail.com-D14836?style=flat&logo=gmail)](mailto:alikhandevs@gmail.com)
[![AWS Community](https://img.shields.io/badge/AWS%20Community-alikhandevs-FF9900?style=flat&logo=amazonaws)](https://community.aws/@alikhandevs)

---

<div align="center">

*Built with ❤️ to solve real infrastructure problems — not just for the portfolio.*

⭐ **If this project helped you or impressed you, consider giving it a star.**

</div>
