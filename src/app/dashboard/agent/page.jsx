import React from 'react'

export default function page() {
    return (
        <div>
            {/* AI Agent Chat - Main Interface */}
      <Card className="h-[85vh]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiOpenai size={20} />
            AI Assistant Chat
          </CardTitle>
          <CardDescription>
            Talk to our AI assistant - it understands DeployEase and can help you deploy, manage, and scale your applications through natural conversation!
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          <AIAgentChat />
        </CardContent>
      </Card>

        </div>
    )
}
