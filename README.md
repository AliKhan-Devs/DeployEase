# DeployEase
![img](./public//archetecture.png)
DeployEase is a deployment automation tool that allows you to deploy Node.js, React, Python, and static applications to AWS EC2 with one click. It automatically configures EC2, installs dependencies, generates Nginx configurations, builds front-end apps, and provides live logs.

---

## Features

* One-click deployment to AWS EC2
* Automatic Nginx configuration
* Automatic EC2 provisioning
* Installs dependencies (npm install, pip install, etc.)
* Supports Node.js, React, Python, and static apps
* Live EC2 logs view
* Clean route structure using utils
* Deployment architecture diagram included (Eraser)

---

## Project Structure

```
DeployEase/
│
├── routes/
│   └── deploy.js
│
├── utils/
│   ├── awsUtils.js
│   ├── nginxUtils.js
│   ├── deployUtils.js
│   └── logsUtils.js
│
├── services/
│   └── ec2Client.js
│
├── README.md
└── package.json
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/DeployEase.git
cd DeployEase
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a `.env` file

```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
GITHUB_TOKEN=your_github_token
```

---

## How It Works

1. User selects a GitHub repository from the dashboard.
2. DeployEase creates an EC2 instance using AWS SDK.
3. Security group and key pair are automatically generated.
4. Repository is cloned into the EC2 instance.
5. App type is detected:

   * Node.js
   * React
   * Python
   * Static site
6. Dependencies are installed.
7. React apps are built.
8. Nginx configuration is generated.
9. Nginx is restarted.
10. URL of the deployed site is returned.

---

## Running Locally

Start the backend:

```bash
npm run dev
```

API runs at:

```
http://localhost:<port>
```

---

## Deployment Output

The deployment returns:

* Application URL
* EC2 Instance ID
* Security Group ID
* SSH Key Name
* Deployment logs
* Final generated Nginx configuration

---

## Diagram

If you exported your Eraser diagram as an image, place it in the root and reference it:

```
![DeployEase Diagram](diagram.png)
```

Or share your Eraser public link.

---


