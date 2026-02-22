import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Code2,
  Cpu,
  Blocks,
  Wrench,
  Zap,
  Github,
  BookOpen,
  ArrowRight,
  Server,
  Layers,
  MessageSquare
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Badge } from './components/ui/badge';
import './App.css';

const App: React.FC = () => {
  const [typedText, setTypedText] = useState('');
  const fullText = "npm run -s bridge -- --method diagnostics.list";
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    let i = 0;
    const typingTimer = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingTimer);
        setTimeout(() => setShowOutput(true), 600);
      }
    }, 50);

    return () => clearInterval(typingTimer);
  }, [fullText]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 opacity-80" />
      <div className="bg-grid-overlay opacity-30 fixed inset-0 z-0 pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/50 bg-slate-950/70 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-lg cursor-pointer">
            <Blocks className="text-blue-500 w-6 h-6" />
            <span className="tracking-tight">AI-Native Bridge</span>
          </div>
          <div className="hidden md:flex gap-6 items-center text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#ecosystem" className="hover:text-white transition-colors">Ecosystem</a>
            <a href="https://github.com/Harkirat155/ai-native/discussions" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Discussions
            </a>
            <a href="https://github.com/Harkirat155/ai-native" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 pt-32 pb-20">

        {/* Hero Section */}
        <section className="flex flex-col items-center text-center mt-12 mb-24 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Badge variant="secondary" className="mb-6 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 px-3 py-1">
            <Zap className="w-3.5 h-3.5 mr-2" />
            v1.0 Protocol Now Live
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400">
            Empower AI Agents <br className="hidden md:inline" />
            Inside VS Code
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl leading-relaxed">
            Expose VS Code's rich capabilities over a local JSON-RPC API. Let agents and CLI tools drive workflows, read diagnostics, and orchestrate UI actions seamlessly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-20 w-full sm:w-auto">
            <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-200 px-8 py-6 text-base rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white px-8 py-6 text-base rounded-full backdrop-blur-sm" asChild>
              <a href="https://github.com/Harkirat155/ai-native/blob/main/docs/protocol-v1.md" target="_blank" rel="noreferrer">
                <BookOpen className="mr-2 w-5 h-5" /> Read Docs
              </a>
            </Button>
          </div>

          {/* Interactive Mock Terminal */}
          <div className="w-full max-w-3xl rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-[#0f111a] text-left ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-both">
            <div className="flex items-center px-4 py-3 bg-[#1e212b] border-b border-white/5">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="text-xs text-slate-500 ml-4 font-mono font-medium">agent-shell — 127.0.0.1</div>
            </div>
            <div className="p-6 font-mono text-sm sm:text-base selection:bg-blue-500/30">
              <div className="mb-2">
                <span className="text-emerald-400 mr-2">❯</span>
                <span className="text-slate-200">vscode-bridge doctor</span>
              </div>
              <div className="text-emerald-500 mb-1">✓ Environment sanity check passed</div>
              <div className="text-slate-400 mb-6">✓ Connected to VS Code Bridge at ws://127.0.0.1:45321</div>

              <div>
                <span className="text-emerald-400 mr-2">❯</span>
                <span className="text-slate-200">{typedText}</span>
                {!showOutput && <span className="inline-block w-2 ml-1 h-5 bg-slate-200 animate-pulse align-middle" />}
              </div>

              {showOutput && (
                <div className="mt-4 animate-in fade-in duration-300">
                  <pre className="text-slate-400 whitespace-pre-wrap"><code className="language-json">{`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "diagnostics": [
      {
        "uri": "file:///src/main.ts",
        "message": "Cannot find name 'config'.",
        "severity": 1,
        "line": 42
      }
    ]
  }
}`}</code></pre>
                  <div className="mt-4">
                    <span className="text-emerald-400 mr-2">❯</span>
                    <span className="inline-block w-2 ml-1 h-5 bg-slate-200 animate-pulse align-middle" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Bridging the Gap</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              A single, robust API that securely exposes everything your IDE can do to intelligent agents, scripts, and MCP servers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4">
                  <Terminal className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl text-slate-100">JSON-RPC / WebSockets</CardTitle>
                <CardDescription className="text-slate-400 text-base leading-relaxed mt-2">
                  Fast, bidirectional communication over localhost. Standardized protocol allowing seamless integration natively or via MCP.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                  <Code2 className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl text-slate-100">Rich Diagnostics</CardTitle>
                <CardDescription className="text-slate-400 text-base leading-relaxed mt-2">
                  Agents can fetch inline compilation errors, linter warnings, and project-wide diagnostics to autonomously fix code.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                  <Wrench className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl text-slate-100">Editor Commands</CardTitle>
                <CardDescription className="text-slate-400 text-base leading-relaxed mt-2">
                  Execute over 1000+ native VS Code commands directly from agents, manipulating UI, files, and debugging sessions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Ecosystem Section */}
        <section id="ecosystem" className="py-24 relative">
          <div className="absolute inset-0 bg-blue-900/10 rounded-3xl blur-3xl -z-10" />
          <div className="border border-slate-800/60 bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 md:p-16">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Plug into the Ecosystem</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                Whether you're building a Python CLI or a Claude-based MCP system, we have first-class SDKs and adapters.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="group rounded-2xl border border-slate-800 bg-slate-900 p-8 hover:border-blue-500/30 transition-all hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)]">
                <Server className="w-10 h-10 text-blue-400 mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-slate-100">MCP Compatibility</h3>
                <p className="text-slate-400 leading-relaxed">
                  Run an MCP server that instantly exposes all bridge methods as MCP tools for Claude and other context-aware LLMs.
                </p>
              </div>

              <div className="group rounded-2xl border border-slate-800 bg-slate-900 p-8 hover:border-purple-500/30 transition-all hover:shadow-[0_0_30px_-10px_rgba(168,85,247,0.2)]">
                <Cpu className="w-10 h-10 text-purple-400 mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-slate-100">Python Async SDK</h3>
                <p className="text-slate-400 leading-relaxed">
                  A native <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">ai-native-sdk</code> python package auto-generated from the OpenAPI schema for robust typing and async methods.
                </p>
              </div>

              <div className="group rounded-2xl border border-slate-800 bg-slate-900 p-8 hover:border-emerald-500/30 transition-all hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]">
                <Layers className="w-10 h-10 text-emerald-400 mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-slate-100">Agent Skills</h3>
                <p className="text-slate-400 leading-relaxed">
                  Supports agentskills.io. Your agent automatically learns how to install, connect, and utilize the bridge on the fly.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-md pb-12 pt-16 mt-12 relative z-10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
            <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-sm">
              <div className="flex items-center gap-2 font-bold mb-4 text-slate-100">
                <Blocks className="text-blue-500 w-5 h-5" />
                <span>AI-Native Bridge</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Empowering next-generation autonomous coding workflows by bridging the gap between AI and IDEs.
              </p>
            </div>

            <div className="flex gap-12 text-sm">
              <div className="flex flex-col gap-3">
                <h4 className="font-semibold text-slate-100 mb-2">Resources</h4>
                <a href="https://github.com/Harkirat155/ai-native/blob/main/INSTALL.md" className="text-slate-400 hover:text-white transition-colors">Installation</a>
                <a href="https://github.com/Harkirat155/ai-native/blob/main/docs/protocol-v1.md" className="text-slate-400 hover:text-white transition-colors">Protocol Docs</a>
                <a href="https://agentskills.io/" className="text-slate-400 hover:text-white transition-colors">Agent Skills</a>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="font-semibold text-slate-100 mb-2">Community</h4>
                <a href="https://github.com/Harkirat155/ai-native" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                  <Github className="w-4 h-4" /> Repository
                </a>
                <a href="https://github.com/Harkirat155/ai-native/issues" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Report an Issue
                </a>
                <a href="https://github.com/Harkirat155/ai-native/discussions" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Discussions
                </a>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} AI-Native VS Code Bridge. Open Source.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
