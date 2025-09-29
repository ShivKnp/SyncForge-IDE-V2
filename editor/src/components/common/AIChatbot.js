// src/components/AIChatbot.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import { Spin, message, Tooltip, Alert } from "antd";
import {
  SendOutlined,
  LoadingOutlined,
  CopyOutlined,
  RobotOutlined,
  CheckOutlined,
  DeleteOutlined,
  StopOutlined,
  DownOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";
import { Select, InputNumber, Button, Space, Popover } from "antd";

// ------------------
// Configuration
// ------------------
const DEFAULT_MAX_OUTPUT_TOKENS = parseInt(process.env.REACT_APP_GEMINI_MAX_OUTPUT_TOKENS || "65535", 10);

const CURATED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.1",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.0"
];

const MODEL_LIMITS = {
  "gemini-2.5-flash": 65535,
  "gemini-2.5-pro": 65535,
  "gemini-2.1": 32768,
  "gemini-2.0-flash": 32768,
  "gemini-1.5-pro": 8192,
  "gemini-1.5-flash": 8192,
  "gemini-1.0": 4096
};

const MIN_CODE_LENGTH = 70;

export default function AIChatbot({
  apiKey = process.env.REACT_APP_GEMINI_API_KEY,
  roomId = "default-room",
  userName = "guest",
  isEnabled = true,
  onToggle = () => {},
  isHost = false,
  isDocked = false,
  onToggleDock = () => {},
  showSummary = false,
  aiInMain = false
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedStates, setCopiedStates] = useState({});
  const [incompleteResponse, setIncompleteResponse] = useState(false);
  const [lastMessageContext, setLastMessageContext] = useState(null);
  const [continuationRequested, setContinuationRequested] = useState(false);
  const [responseHistory, setResponseHistory] = useState([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);

  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem("gemini_selected_model") || CURATED_MODELS[0];
  });
  const [availableModels, setAvailableModels] = useState([]);

  const [maxOutputTokens, setMaxOutputTokens] = useState(() => {
    const saved = parseInt(localStorage.getItem("gemini_max_output_tokens"), 10);
    if (Number.isFinite(saved) && saved > 0) {
      const model = localStorage.getItem("gemini_selected_model") || CURATED_MODELS[0];
      const limit = MODEL_LIMITS[model] || DEFAULT_MAX_OUTPUT_TOKENS;
      return Math.min(saved, limit);
    }
    const startModel = localStorage.getItem("gemini_selected_model") || CURATED_MODELS[0];
    return MODEL_LIMITS[startModel] || DEFAULT_MAX_OUTPUT_TOKENS;
  });

  const [manualModelSelection, setManualModelSelection] = useState(() => {
    return localStorage.getItem("gemini_selected_model") || selectedModel;
  });

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const stopSignalRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const shouldScrollToBottomRef = useRef(false);
  const debounceTimeoutRef = useRef(null);

  // Save messages to localStorage for sidebar access
  useEffect(() => {
    try {
      localStorage.setItem(`ai-chat-${roomId}-${userName}-summary`, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to save messages to localStorage", e);
    }
  }, [messages, roomId, userName]);
  
  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem("gemini_max_output_tokens", String(maxOutputTokens));
    } catch {}
  }, [maxOutputTokens]);

  useEffect(() => {
    if (manualModelSelection) {
      try { localStorage.setItem("gemini_selected_model", manualModelSelection); } catch {}
      setSelectedModel(manualModelSelection);
    }
  }, [manualModelSelection]);

  // When selectedModel changes, clamp token value to that model's limit
  useEffect(() => {
    const limit = MODEL_LIMITS[selectedModel] || DEFAULT_MAX_OUTPUT_TOKENS;
    setMaxOutputTokens(prev => {
      if (!Number.isFinite(prev) || prev < 1) return limit;
      return Math.min(prev, limit);
    });
  }, [selectedModel]);

  // Load saved messages on mount and scroll to bottom immediately
  useEffect(() => {
    try {
      const s = localStorage.getItem(`ai-chat-${roomId}-${userName}`);
      if (s) {
        const savedMessages = JSON.parse(s);
        setMessages(savedMessages);
        if (savedMessages.length > 0) {
          shouldScrollToBottomRef.current = true;
        }
      }
    } catch (e) {
      console.warn("Failed to load saved messages", e);
    }
    
    // Mark initial render complete after a short delay
    const timer = setTimeout(() => {
      setIsInitialRender(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [roomId, userName]);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`ai-chat-${roomId}-${userName}`, JSON.stringify(messages));
    } catch (e) {}
  }, [messages, roomId, userName]);

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) return;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
        );
        if (!res.ok) {
          console.warn("Models list fetch failed", res.status);
          setAvailableModels(CURATED_MODELS);
          return;
        }
        const data = await res.json();
        const names = (data.models || []).map((m) => {
          if (m.name) return m.name.split("/").pop();
          if (m.displayName) return m.displayName;
          return null;
        }).filter(Boolean);

        const curatedAvailable = CURATED_MODELS.filter(m => names.includes(m));
        setAvailableModels(curatedAvailable.length ? curatedAvailable : CURATED_MODELS);

        const chosen = CURATED_MODELS.find((p) => names.includes(p)) || selectedModel;
        if (chosen && chosen !== selectedModel) {
          setSelectedModel(chosen);
          setManualModelSelection(chosen);
          message.info(`Using model: ${chosen}`);
        }
      } catch (e) {
        console.warn("Could not fetch models list", e);
        setAvailableModels(CURATED_MODELS);
      }
    };
    fetchModels();
  }, [apiKey]);

  // Optimized scroll handler with debouncing
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = distance <= 100;
        isAtBottomRef.current = atBottom;
        setShowScrollToBottom(!atBottom && messages.length > 3);
      }, 50);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [messages.length]);

  // Optimized scroll to bottom effect
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    
    if (shouldScrollToBottomRef.current || isAtBottomRef.current || isInitialRender) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        endRef.current?.scrollIntoView({ block: "end" });
        shouldScrollToBottomRef.current = false;
      });
    }
  }, [messages, loading, isInitialRender]);

  // Format time helper
  const fmtTime = useCallback((iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, []);

  // Optimized markdown normalization with memoization
  const normalizeMarkdownSafe = useCallback((md) => {
    if (!md || typeof md !== "string") return md;
    
    // Basic cleanup
    md = md.replace(/\*\*\s*`([^`]+)`\s*\*\*/g, "**$1**");
    md = md.replace(/(#+\s+)\*\*`([^`]+)`\*\*/g, "$1**$2**");
    md = md.replace(/\*\*`([^`]+)`\*\*/g, "**$1**");
    md = md.replace(/\*\* \*\*/g, "**").replace(/\*\*:/g, ":");
    md = md.replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/&nbsp;/g, " ");

    return md;
  }, []);

  const shouldSkipNormalize = useCallback((text) => {
    if (!text || typeof text !== "string") return false;
    return /(^|\n)\s*(`{3,}|~{3,})/.test(text);
  }, []);

  // Optimized code renderer with stable rendering
  const CodeRenderer = useCallback(({ inline, className, children, ...props }) => {
    const raw = Array.isArray(children) ? children.join("") : String(children || "");
    const trimmed = raw.replace(/\n+$/, "\n");
    const compactLen = trimmed.replace(/\s+/g, " ").trim().length;
    const codeId = useMemo(() => Math.random().toString(36).substr(2, 9), [raw]);

    if (compactLen <= MIN_CODE_LENGTH) {
      return <span className="plain-code">{trimmed}</span>;
    }

    if (inline) {
      return <code className="ok-inline-code" {...props}>{trimmed}</code>;
    }

    let lang = "text";
    if (className) {
      const langMatch = className.match(/language-([a-zA-Z0-9_+-]+)/) || className.match(/(?:^|\s)([a-zA-Z0-9_+-]+)(?:\s|$)/);
      if (langMatch && langMatch[1]) lang = langMatch[1].toLowerCase();
    }

    const languageMap = {
      py: "python", python3: "python", js: "javascript", jsx: "javascript",
      ts: "typescript", tsx: "typescript", cpp: "cpp", "c++": "cpp", c: "c",
      java: "java", html: "html", css: "css", sh: "bash", bash: "bash", shell: "bash",
      zsh: "bash", json: "json", xml: "xml", sql: "sql", php: "php", rb: "ruby",
      go: "go", rs: "rust", rust: "rust", swift: "swift", kt: "kotlin", kotlin: "kotlin",
      md: "markdown", markdown: "markdown", yaml: "yaml", yml: "yaml", txt: "text", text: "text"
    };

    const properLang = languageMap[lang] || lang;
    const formatLanguageName = (l) => {
      const map = {
        python: "Python", javascript: "JavaScript", typescript: "TypeScript",
        cpp: "C++", c: "C", java: "Java", html: "HTML", css: "CSS",
        bash: "Bash", json: "JSON", xml: "XML", sql: "SQL", php: "PHP",
        ruby: "Ruby", go: "Go", rust: "Rust", swift: "Swift", kotlin: "Kotlin",
        markdown: "Markdown", yaml: "YAML", text: "Text"
      };
      return map[l] || (l.charAt(0).toUpperCase() + l.slice(1));
    };

    const displayLang = formatLanguageName(properLang);
    const isCopied = copiedStates[codeId];

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(trimmed);
        setCopiedStates(prev => ({ ...prev, [codeId]: true }));
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [codeId]: false })), 2000);
      } catch (e) {
        message.error("Copy failed");
      }
    };

    const lineCount = trimmed.split("\n").length;
    const showLines = lineCount > 2;

    return (
      <div className="code-block-wrapper" role="group" aria-label={`Code block: ${displayLang}`}>
        <div className="code-block-header">
          <div className="code-language">{displayLang}</div>
          <div>
            <Tooltip title={isCopied ? "Copied!" : "Copy code"}>
              <button onClick={handleCopy} aria-label="Copy code" className="copy-btn">
                {isCopied ? <CheckOutlined style={{ color: "#52c41a" }} /> : <CopyOutlined />}
              </button>
            </Tooltip>
          </div>
        </div>

        <SyntaxHighlighter
          language={properLang}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            border: "none",
            borderRadius: "0 0 8px 8px",
            fontSize: "13px",
            lineHeight: "1.4",
            overflowX: "auto"
          }}
          wrapLongLines={false}
          PreTag="pre"
          showLineNumbers={showLines}
          lineNumberStyle={{
            color: "#6b7280",
            paddingRight: "10px",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            minWidth: "32px",
            textAlign: "right",
            userSelect: "none",
            fontSize: "11px"
          }}
          codeTagProps={{
            style: {
              fontFamily: '"Fira Code", "Monaco", "Cascadia Code", "Consolas", monospace',
              whiteSpace: 'pre',
              tabSize: 4,
              padding: "12px"
            }
          }}
          className="syntax-highlighter"
        >
          {trimmed}
        </SyntaxHighlighter>
      </div>
    );
  }, [copiedStates]);

  // Memoized markdown components
  const MarkdownComponents = useMemo(() => ({
    code: CodeRenderer,
    h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
    h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
    h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />,
    h4: ({ node, ...props }) => <h4 className="markdown-h4" {...props} />,
    h5: ({ node, ...props }) => <h5 className="markdown-h5" {...props} />,
    h6: ({ node, ...props }) => <h6 className="markdown-h6" {...props} />,
    ul: ({ node, ...props }) => <ul className="markdown-ul" {...props} />,
    ol: ({ node, ...props }) => <ol className="markdown-ol" {...props} />,
    li: ({ node, ...props }) => <li className="markdown-li" {...props} />,
    hr: ({ node, ...props }) => <hr className="markdown-hr" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="markdown-blockquote" {...props} />,
    table: ({ node, ...props }) => <div className="markdown-table-container"><table className="markdown-table" {...props} /></div>,
    thead: ({ node, ...props }) => <thead className="markdown-thead" {...props} />,
    tbody: ({ node, ...props }) => <tbody className="markdown-tbody" {...props} />,
    tr: ({ node, ...props }) => <tr className="markdown-tr" {...props} />,
    th: ({ node, ...props }) => <th className="markdown-th" {...props} />,
    td: ({ node, ...props }) => <td className="markdown-td" {...props} />
  }), [CodeRenderer]);

  // Continue button component
  const ContinueButton = useCallback(() => {
    const handleContinue = async () => {
      setContinuationRequested(true);
      await sendMessage(null, null, true);
    };

    return (
      <div className="continue-section animate-fadeInUp">
        <div className="continue-divider"></div>
        <button className="continue-btn" onClick={handleContinue} disabled={loading || continuationRequested}>
          {continuationRequested ? (<><LoadingOutlined spin /> Continuing...</>) : (<><SendOutlined /> Continue Response</>)}
        </button>
        <div className="continue-tip">Click to continue the response from where it was cut off</div>
      </div>
    );
  }, [loading, continuationRequested]);

  // Stop generation handler
  const stopGeneration = useCallback(() => {
    if (!loading) return;
    stopSignalRef.current = true;
    setLoading(false);
    setContinuationRequested(false);
    message.info("Generation stopped");
  }, [loading]);

  // Jump to bottom function
  const jumpToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    endRef.current?.scrollIntoView({ block: "end" });
    isAtBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  // Clear messages handler
  const handleClearMessages = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setMessages([]);
      localStorage.removeItem(`ai-chat-${roomId}-${userName}`);
      setIncompleteResponse(false);
      setLastMessageContext(null);
      setResponseHistory([]);
      message.success("Cleared");
      setIsTransitioning(false);
    }, 300);
  }, [roomId, userName]);

  // Optimized sendMessage function
  const sendMessage = useCallback(async (text, fileData = null, isContinuation = false) => {
    if ((!text?.trim() && !fileData) && !isContinuation) return;

    let userMsg;
    if (!isContinuation && text) {
      userMsg = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString()
      };
      setMessages((s) => [...s, userMsg]);
      setInput("");
    }

    setLoading(true);
    setContinuationRequested(false);
    stopSignalRef.current = false;

    try {
      let aiText = "";

      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: selectedModel || CURATED_MODELS[0],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            topK: 32,
            maxOutputTokens: Math.min(MODEL_LIMITS[selectedModel] || DEFAULT_MAX_OUTPUT_TOKENS, Math.max(1, Number(maxOutputTokens) || DEFAULT_MAX_OUTPUT_TOKENS))
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
          ]
        });

        let prompt;
        if (isContinuation && lastMessageContext) {
          const fullContext = lastMessageContext.truncatedText;
          const originalQuestion = lastMessageContext.originalQuestion;
          prompt = `CONTINUATION REQUEST: Continue the previous response naturally without repetition.\n\nORIGINAL USER QUESTION: "${originalQuestion}"\n\nPREVIOUS RESPONSE CONTENT (that was cut off):\n\n"""\n${fullContext}\n"""\n\nANALYSIS INSTRUCTIONS:\n\n1. Carefully analyze the previous response to understand what topics, concepts, or explanations were being discussed\n\n2. Identify where the response was cut off and what logical content should come next\n\n3. If discussing multiple topics (like Azure services), continue with the next topic in the logical sequence\n\n4. If explaining a concept in-depth, continue the explanation from where it left off\n\n5. If providing code examples, continue with the next part of the code or additional examples\n\n6. If comparing different approaches, continue with the next comparison point\n\nCONTINUATION RULES:\n\n- DO NOT repeat any content from the previous response\n- DO NOT use introductory phrases like \"Continuing from before\" or \"As I was saying\"\n- DO NOT summarize what was already said\n- Start directly with new content that logically follows the previous response\n- Maintain the same formatting style (markdown, code blocks, tables, etc.)\n- If the previous response was listing items, continue with the next items\n- If the previous response was explaining a concept, continue the explanation\n\nContinue with new content that follows logically from the previous response:`;
        } else {
          const conversationContext = messages.slice(-4).map(m => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");
          prompt = `You are an expert personal assistant.\n\nPlease provide accurate, detailed explanations with examples when appropriate. Format your response using markdown with proper code blocks.\n\n${conversationContext ? `Conversation context:\n${conversationContext}\n\n` : ''}User question: ${text}\n\nPlease respond with:\n\n1. A clear explanation of the concept\n\n2.When asked provide proper code examples when relevant (using proper syntax highlighting)\n\n3. Time and space complexity analysis for algorithms\n\n4. Best practices and potential pitfalls\n\n5. Use tables to compare different approaches when appropriate\n\n6. Answers to questions user asks\n\n\nIf your response is long, please structure it in logical sections that can be continued if needed.\n\n\nAnswer:`;
        }

        const result = await model.generateContentStream(prompt);
        let fullResponse = "";

        if (isContinuation) {
          const continuationMessage = {
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
            isContinuation: true
          };
          setMessages((s) => [...s, continuationMessage]);
        }

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullResponse += chunkText;
            if (stopSignalRef.current) {
              break;
            }
            setMessages(prev => {
              const newMessages = [...prev];
              if (isContinuation) {
                const lastIndex = newMessages.length - 1;
                if (newMessages[lastIndex] && newMessages[lastIndex].role === "assistant" && newMessages[lastIndex].isContinuation) {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: fullResponse
                  };
                } else {
                  newMessages.push({ role: "assistant", content: fullResponse, timestamp: new Date().toISOString(), isContinuation: true });
                }
              } else {
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isContinuation) {
                  newMessages[newMessages.length - 1] = { ...lastMsg, content: fullResponse };
                } else {
                  newMessages.push({ role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });
                }
              }
              return newMessages;
            });
          }
        }

        if (stopSignalRef.current) {
          setIncompleteResponse(true);
          setLastMessageContext({
            truncatedText: isContinuation && lastMessageContext ? lastMessageContext.truncatedText + fullResponse : fullResponse,
            originalQuestion: isContinuation && lastMessageContext ? lastMessageContext.originalQuestion : text
          });
          if (!fullResponse.includes("*Response continues...*")) {
            fullResponse += "\n\n---\n\n*Response continues...*";
          }

          setMessages(prev => {
            const newMessages = [...prev];
            if (isContinuation) {
              const idx = newMessages.findIndex(m => m.isContinuation);
              if (idx !== -1) newMessages[idx] = { ...newMessages[idx], content: fullResponse, isContinuation: false };
            } else {
              const lastIdx = newMessages.length - 1;
              if (newMessages[lastIdx] && newMessages[lastIdx].role === "assistant") {
                newMessages[lastIdx] = { ...newMessages[lastIdx], content: fullResponse };
              } else {
                newMessages.push({ role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });
              }
            }
            return newMessages;
          });

          setLoading(false);
          return;
        }

        const response = await result.response;
        if (response && response.text && typeof response.text === "function") {
          const finalText = response.text();
          if (finalText) fullResponse = finalText;
        }

        // Truncation heuristics
        let isTruncated = false;
        try {
          const finishReason = result?.response?.finishReason || (result?.response?.meta || {}).finishReason;
          if (finishReason === "MAX_TOKENS") isTruncated = true;
        } catch (e) {}
        if (!isTruncated) {
          const trimmed = (fullResponse || "").trim();
          if (trimmed.endsWith("...") || trimmed.endsWith("---")) isTruncated = true;
          const codeBlockCount = (fullResponse.match(/```/g) || []).length;
          if (fullResponse.length > 3800) {
            const lastChar = trimmed.slice(-1);
            if (![".", "!", "?", "`", '"', "'", ")", "]", "}"].includes(lastChar)) isTruncated = true;
            if (codeBlockCount % 2 !== 0) isTruncated = true;
            const lastLine = trimmed.split("\n").pop() || "";
            const isListItem = lastLine.startsWith("- ") || lastLine.startsWith("* ") || lastLine.match(/^\d+\./);
            if (isListItem && !lastLine.endsWith(".") && !lastLine.endsWith(":")) isTruncated = true;
            const tableLines = fullResponse.split("\n").filter(line => line.includes("|"));
            if (tableLines.length > 0) {
              const lastTableLine = tableLines[tableLines.length - 1];
              if (!lastTableLine.includes("---") && lastTableLine.split("|").length > 2) isTruncated = true;
            }
          }
        }

        if (isTruncated) {
          setIncompleteResponse(true);
          setLastMessageContext({
            truncatedText: isContinuation && lastMessageContext ? lastMessageContext.truncatedText + fullResponse : fullResponse,
            originalQuestion: isContinuation && lastMessageContext ? lastMessageContext.originalQuestion : text
          });
          if (!fullResponse.includes("*Response continues...*")) {
            fullResponse += "\n\n---\n\n*Response continues...*";
          }
        } else {
          setIncompleteResponse(false);
          setLastMessageContext(null);
        }

        aiText = fullResponse;

        // Final update
        setMessages(prev => {
          const newMessages = [...prev];
          if (isContinuation) {
            const continuationIndex = newMessages.findIndex(m => m.isContinuation);
            if (continuationIndex !== -1) {
              newMessages[continuationIndex] = { ...newMessages[continuationIndex], content: aiText, isContinuation: false };
            }
          } else {
            const assistantIndex = newMessages.findIndex(m => m.role === "assistant" && !m.isContinuation);
            if (assistantIndex !== -1) {
              newMessages[assistantIndex] = { ...newMessages[assistantIndex], content: aiText };
            } else {
              newMessages.push({ role: "assistant", content: aiText, timestamp: new Date().toISOString() });
            }
          }
          return newMessages;
        });
      } else {
        // Demo fallback if no API key
        const lowerText = (text || "").toLowerCase();
        if (lowerText.includes("bubble") || lowerText.includes("sort")) {
          aiText = `**Bubble Sort Algorithm Explanation**\n\nBubble sort is a simple sorting algorithm ...`;
        } else if (lowerText.includes("binary") || lowerText.includes("search")) {
          aiText = `**Binary Search Algorithm Explanation**\n\nBinary search is an efficient algorithm ...`;
        } else {
          aiText = `⚠️ *API key missing or invalid. Using fallback content.*\n\nHere's an explanation about Bubble Sort to help you learn meanwhile:\n\n**Bubble Sort Algorithm Explanation**...`;
        }
        const aiMsg = { role: "assistant", content: aiText, timestamp: new Date().toISOString() };
        setMessages((s) => [...s, aiMsg]);
      }
    } catch (err) {
      console.error("AI error:", err);
      let errorMessage = "Sorry — I encountered an error processing your request. Please try again in a moment.";
      if (err.message?.includes("quota")) {
        errorMessage = "API quota exceeded. Please try again later or check your API key limits.";
      } else if (err.message?.includes("API key")) {
        errorMessage = "Invalid API key. Please check your Gemini API key configuration.";
      } else if (err.message?.includes("length")) {
        errorMessage = "Response too long. Please try a more specific question or break it down into smaller parts.";
      }
      const errMsg = { role: "assistant", content: errorMessage, timestamp: new Date().toISOString() };
      setMessages((s) => [...s, errMsg]);
      message.error("AI request failed");
    } finally {
      setLoading(false);
    }
  }, [apiKey, selectedModel, maxOutputTokens, messages, lastMessageContext]);

  // Optimized input change handler with better performance
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInput(value);
  }, []);

  // Optimized key down handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) {
        sendMessage(input);
      }
    }
  }, [input, sendMessage, loading]);

// Compact settings popover content
const settingsContent = useMemo(() => (
  <div className="compact-settings-popover w-64">
    {/* Compact Header */}
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30">
      <div className="terminal-toggle active w-5 h-5">
        <SettingOutlined className="terminal-icon" style={{ fontSize: '10px' }} />
      </div>
      <div className="text-slate-100 font-semibold text-xs">AI Config</div>
    </div>
    
    {/* Compact Body */}
    <div className="p-3 space-y-3">
      {/* AI Model - Compact */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🤖</span>
          <span className="text-slate-300 font-medium text-xs">Model</span>
        </div>
        <Select
          size="small"
          style={{ width: "100%" }}
          value={manualModelSelection || selectedModel}
          onChange={(val) => setManualModelSelection(val)}
          showSearch
          placeholder="Select model..."
          optionFilterProp="children"
          filterOption={(input, option) =>
            String(option?.children).toLowerCase().includes(String(input).toLowerCase())
          }
          className="compact-select"
          popupClassName="compact-select-dropdown"
          dropdownStyle={{ 
            background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.95))',
            border: '1px solid rgba(14, 165, 164, 0.15)',
            borderRadius: '8px',
            backdropFilter: 'blur(20px)'
          }}
        >
          {(availableModels.length ? availableModels : CURATED_MODELS).map((m) => (
            <Select.Option 
              key={m} 
              value={m}
              className="text-slate-200 hover:bg-slate-700/50 text-xs"
            >
              {m}
            </Select.Option>
          ))}
        </Select>
      </div>
      
      {/* Max Output Tokens - Compact */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">⚡</span>
          <span className="text-slate-300 font-medium text-xs">Max Tokens</span>
        </div>
        <div className="flex items-center gap-2">
          <InputNumber
            size="small"
            min={1}
            max={MODEL_LIMITS[manualModelSelection || selectedModel] || DEFAULT_MAX_OUTPUT_TOKENS}
            value={maxOutputTokens}
            onChange={(v) => {
              const parsed = Number(v) || 0;
              const limit = MODEL_LIMITS[manualModelSelection || selectedModel] || DEFAULT_MAX_OUTPUT_TOKENS;
              const clamped = Math.min(limit, Math.max(1, parsed));
              setMaxOutputTokens(clamped);
            }}
            controls={false}
            parser={(val) => parseInt(val||"0", 10)}
            style={{ width: "100%" }}
            className="compact-input-number"
          />
          <div className="text-slate-400 text-xs whitespace-nowrap">
            / {MODEL_LIMITS[manualModelSelection || selectedModel] || DEFAULT_MAX_OUTPUT_TOKENS}
          </div>
        </div>
      </div>
    </div>
    
    {/* Compact Footer */}
    <div className="px-3 py-2 border-t border-slate-700/30">
      <Button
        size="small"
        type="primary"
        onClick={() => {
          try {
            localStorage.setItem("gemini_max_output_tokens", String(maxOutputTokens));
            localStorage.setItem("gemini_selected_model", manualModelSelection || selectedModel);
          } catch {}
          message.success("Settings saved");
          if (manualModelSelection) setSelectedModel(manualModelSelection);
          setShowSettings(false);
        }}
        className="compact-save-btn w-full justify-center text-xs h-7"
        icon={<CheckOutlined style={{ fontSize: '10px' }} />}
      >
        Save
      </Button>
    </div>
  </div>
), [availableModels, manualModelSelection, selectedModel, maxOutputTokens]);

  return (
    <div className="ai-shell animate-slideInUp" style={{ position: "relative" }}>
      <div className="ai-header">
  <div className="header-content">
    <div className="title-section group">
      <div className="icon-container">
        <RobotOutlined className="ai-title-icon" />
      </div>
      <div className="title-text-container">
        <div className="ai-title-text">AI Assistant</div>
        {messages.length > 0 && (
          <div className="message-count">
            {messages.filter(m => m.role === "user").length} questions
          </div>
        )}
      </div>
    </div>
    
    <div className="controls-section">
      <Tooltip title={isDocked ? "Undock to sidebar" : "Expand to main view"} placement="bottom" color="#0f172a">
        
        <button
          onClick={onToggleDock}
          className="control-btn dock-btn"
          aria-label={isDocked ? "Undock" : "Expand"}
        >
          {isDocked ? <CompressOutlined /> : <ExpandOutlined />}
        </button>
      </Tooltip>

      <Popover
  content={settingsContent}
  trigger="click"
  open={showSettings}
  onOpenChange={setShowSettings}
  placement="bottomRight"
  overlayClassName="compact-settings-popover"
  overlayInnerStyle={{
    background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,26,0.98))',
    border: '1px solid rgba(14, 165, 164, 0.15)',
    borderRadius: '12px',
    boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(14, 165, 164, 0.1)',
    backdropFilter: 'blur(20px)',
    padding: '0'
  }}
>
  <Tooltip title="Model settings" placement="bottom" color="#0f172a">
    <button 
      className="control-btn settings-btn terminal-toggle" 
      aria-label="Model settings"
    >
      <SettingOutlined className="terminal-icon" />
    </button>
  </Tooltip>
</Popover>
      
      {messages.length > 0 && (
        <Tooltip title="Clear conversation" placement="bottom" color="#0f172a">
          <button
            onClick={handleClearMessages}
            className="control-btn clear-btn"
            aria-label="Clear conversation"
          >
            <DeleteOutlined />
          </button>
        </Tooltip>
      )}
    </div>
  </div>
</div>

      {/* Show summary when docked in sidebar and in summary mode */}
      {isDocked && showSummary && !aiInMain ? (
        <div className="ai-summary-mode animate-fadeIn">
          <div className="ai-summary">
            <div className="ai-summary-stats">
              <p>
                {messages.length === 0 ? (
                  "No conversation yet"
                ) : (
                  `${messages.filter(m => m.role === "user").length} questions, ${messages.filter(m => m.role === "assistant").length} responses`
                )}
              </p>
              {messages.length > 0 && (
                <p className="ai-last-activity">
                  Last activity: {fmtTime(messages[messages.length - 1]?.timestamp)}
                </p>
              )}
            </div>
            
            <div className="ai-summary-status">
              <span className="ai-status-indicator"></span>
              <span>AI Assistant ready</span>
            </div>
          </div>
          
          <button 
            className="ai-show-full-btn group"
            onClick={onToggleDock}
          >
            <ExpandOutlined className="transition-transform duration-200 group-hover:scale-110" />
            Open Full Chat
          </button>
        </div>
      ) : (
        <>
          {messages.length === 0 && !isDocked && (
            <div className="ai-empty animate-fadeIn">
              <div className="ai-welcome">
                <h3 className="welcome-title">Hello! I'm your AI Coding Assistant</h3>
                <p className="welcome-subtitle">I can help explain algorithms, data structures, and programming concepts.</p>
                <div className="welcome-features">
                  <div className="feature-item">
                    <span className="feature-icon">💡</span>
                    <span>Code explanations</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🔍</span>
                    <span>Algorithm analysis</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🚀</span>
                    <span>Best practices</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div 
            className="ai-body" 
            ref={messagesRef}
            style={{
              opacity: isTransitioning ? 0.6 : 1,
              transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'scroll-position',
              paddingBottom: '120px' // Add extra padding to prevent input overlap
            }}
          >
            {messages.map((m, i) => (
              <div 
                key={`${m.role}-${i}-${m.timestamp}`}
                className={`ai-row ${m.role === "user" ? "user" : "assistant"} animate-messageSlideIn`}
                style={{
                  animationDelay: `${(i % 5) * 50}ms`,
                  animationFillMode: 'both'
                }}
              >
                <div className="ai-bubble">
                  {m.role === "assistant" ? (
                    <div className="markdown-wrap">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={MarkdownComponents}
                      >
                        {shouldSkipNormalize(m.content) ? m.content : normalizeMarkdownSafe(m.content)}
                      </ReactMarkdown>

                      {incompleteResponse && i === messages.length - 1 && (
                        <ContinueButton />
                      )}
                    </div>
                  ) : (
                    <div className="user-text">{m.content}</div>
                  )}
                  <div className="ai-ts">{fmtTime(m.timestamp)}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-row assistant animate-messageSlideIn">
                <div className="ai-bubble">
                  <div className="loading-indicator">
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
                    <span className="loading-text">thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Scroll to bottom floating button */}
          {showScrollToBottom && (
            <button 
              className="scroll-to-bottom animate-bounceIn" 
              onClick={jumpToBottom} 
              title="Scroll to latest"
            >
              <DownOutlined />
            </button>
          )}

          <div className="ai-input">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={apiKey ? "Ask me anything..." : "Demo mode — no API key"}
              disabled={loading}
              rows={1}
              className="ai-textarea"
              style={{ 
                willChange: 'contents',
                transform: 'translateZ(0)', // Force GPU acceleration
                contain: 'layout'
              }}
            />

            {/* Stop button while generating */}
            {loading ? (
              <button onClick={stopGeneration} className="ai-stop-btn" aria-label="Stop generation" title="Stop generation">
                <StopOutlined />
              </button>
            ) : null}

            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="ai-send-btn"
              aria-label="Send"
            >
              {loading ? <LoadingOutlined spin /> : <SendOutlined />}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        /* ==========================
           Enhanced Animations & Performance
           ========================== */
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateX(-15px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(20px);
          }
          50% {
            opacity: 1;
            transform: scale(1.05) translateY(-3px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pulse {
          0% { 
            opacity: 1; 
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0.7);
          } 
          70% { 
            opacity: 0.6; 
            box-shadow: 0 0 0 10px rgba(14, 165, 164, 0);
          } 
          100% { 
            opacity: 1; 
            box-shadow: 0 0 0 0 rgba(14, 165, 164, 0);
          } 
        }

        @keyframes iconBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-2px); }
          60% { transform: translateY(-1px); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-slideInUp {
          animation: slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-messageSlideIn {
          animation: messageSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-bounceIn {
          animation: bounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        /* ==========================
           Main Container & Performance
           ========================== */
        .ai-shell {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          background: linear-gradient(180deg, #071126 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(2,6,23,0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(14, 165, 164, 0.08);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform;
          backface-visibility: hidden;
        }

        .ai-shell::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at top right, rgba(14, 165, 164, 0.03), transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .ai-shell > * {
          position: relative;
          z-index: 1;
        }

        

        /* ==========================
           Enhanced Header Styling (Matching ParticipantsList)
           ========================== */
        .ai-header {
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
  border-bottom: 1px solid rgba(14, 165, 164, 0.08);
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  z-index: 20;
  min-height: 48px; /* Fixed height to prevent shrinking */
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.title-text-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-title-text {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  transition: all 0.3s ease;
  line-height: 1.2;
}

.message-count {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 500;
  transition: all 0.3s ease;
}

.title-section.group:hover .message-count {
  color: #0ea5a4;
}

.icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

.ai-title-icon {
  color: #0ea5a4;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
}

.title-section.group:hover .icon-container {
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
  border-color: rgba(14, 165, 164, 0.3);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 6px 20px rgba(14, 165, 164, 0.15);
}

.title-section.group:hover .ai-title-icon {
  transform: scale(1.1);
  animation: iconBounce 0.6s ease;
}

.title-section.group:hover .ai-title-text {
  color: #0ea5a4;
  text-shadow: 0 0 6px rgba(14, 165, 164, 0.2);
}

.controls-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.control-btn {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(14, 165, 164, 0.08);
  color: #94a3b8;
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 12px;
  width: 30px;
  height: 30px;
  backdrop-filter: blur(4px);
  flex-shrink: 0;
}

.control-btn:hover {
  background: rgba(14,116,144,0.08);
  border-color: rgba(14,116,144,0.2);
  color: #0ea5a4;
  transform: translateY(-1px) scale(1.1);
  box-shadow: 0 4px 12px rgba(14, 165, 164, 0.15);
}

.clear-btn:hover {
  background: rgba(239,68,68,0.08) !important;
  border-color: rgba(239,68,68,0.2) !important;
  color: #f87171 !important;
  transform: translateY(-1px) scale(1.1);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

// Mobile responsiveness
@media (max-width: 768px) {
  .ai-header {
    padding: 8px 12px;
    min-height: 44px;
  }
  
  .header-content {
    gap: 10px;
  }
  
  .ai-title-text {
    font-size: 12px;
  }
  
  .message-count {
    font-size: 9px;
  }
  
  .icon-container {
    width: 28px;
    height: 28px;
  }
  
  .ai-title-icon {
    font-size: 12px;
  }
  
  .controls-section {
    gap: 4px;
  }
  
  .control-btn {
    width: 26px;
    height: 26px;
    padding: 5px;
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .ai-header {
    padding: 6px 10px;
    min-height: 40px;
  }
  
  .title-section {
    gap: 8px;
  }
  
  .ai-title-text {
    font-size: 11px;
  }
  
  .message-count {
    font-size: 8px;
  }
  
  .icon-container {
    width: 24px;
    height: 24px;
  }
  
  .ai-title-icon {
    font-size: 10px;
  }
  
  .control-btn {
    width: 24px;
    height: 24px;
    padding: 4px;
    font-size: 10px;
  }
}

        /* ==========================
           Summary Mode (Enhanced)
           ========================== */
        .ai-summary-mode {
          padding: 16px;
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          background: linear-gradient(180deg, rgba(7,17,38,0.4), rgba(15,23,42,0.6));
          position: relative;
          overflow: hidden;
        }

        .ai-summary-mode::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at center, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
        }

        .ai-summary {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .ai-summary-stats p {
          color: #cbd5e1;
          margin-bottom: 12px;
          font-size: 13px;
          line-height: 1.4;
          transition: all 0.3s ease;
          font-weight: 500;
        }

        .ai-last-activity {
          font-size: 11px !important;
          opacity: 0.8;
          color: #94a3b8 !important;
          font-style: italic;
        }

        .ai-summary-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #0ea5a4;
          font-size: 12px;
          margin: 16px 0;
          transition: all 0.3s ease;
          font-weight: 500;
        }

        .ai-status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0ea5a4, #0891b2);
          animation: pulse 2s infinite;
          box-shadow: 0 0 8px rgba(14, 165, 164, 0.4);
        }

        .ai-show-full-btn {
          background: linear-gradient(135deg, rgba(14,116,144,0.15), rgba(14,116,144,0.1));
          border: 1px solid rgba(14,116,144,0.25);
          color: #0ea5a4;
          padding: 12px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: auto;
          backdrop-filter: blur(12px);
          position: relative;
          overflow: hidden;
          z-index: 1;
        }

        .ai-show-full-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.2), transparent);
          transition: left 0.5s ease;
          z-index: -1;
        }

        .ai-show-full-btn:hover::before {
          left: 100%;
        }

        .ai-show-full-btn:hover {
          background: linear-gradient(135deg, rgba(14,116,144,0.25), rgba(14,116,144,0.2));
          border-color: rgba(14,116,144,0.4);
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.25);
        }

        /* ==========================
           Body & Message Containers (Fixed Positioning)
           ========================== */
        .ai-body {
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 16px 18px 20px 18px; /* Reduced bottom padding */
          min-height: 0;
          scroll-behavior: smooth;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.03));
          position: relative;
          will-change: scroll-position;
          transform: translateZ(0);
        }

        /* Fix for input overlap - ensure proper spacing */
        .ai-body::after {
          content: '';
          display: block;
          height: 100px; /* Extra space at bottom to prevent overlap */
          flex-shrink: 0;
        }

        .ai-body::-webkit-scrollbar {
          width: 6px;
        }

        .ai-body::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 3px;
        }

        .ai-body::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-radius: 3px;
          transition: background 0.3s ease;
        }

        .ai-body::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(14, 165, 164, 0.4), rgba(14, 116, 144, 0.4));
        }

        .ai-empty {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          color: #94a3b8;
          text-align: center;
          padding: 24px;
        }

        .ai-welcome {
          max-width: 400px;
          position: relative;
        }

        .welcome-title {
          color: #f1f5f9;
          margin-bottom: 12px;
          font-size: 16px;
          font-weight: 600;
          background: linear-gradient(135deg, #f1f5f9, #0ea5a4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          transition: all 0.3s ease;
          text-shadow: 0 0 20px rgba(14, 165, 164, 0.1);
        }

        .welcome-subtitle {
          color: #b9c6d4;
          margin: 0 0 20px 0;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 400;
        }

        .welcome-features {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 20px;
          flex-wrap: wrap;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.08), rgba(14, 116, 144, 0.05));
          border: 1px solid rgba(14, 165, 164, 0.15);
          border-radius: 20px;
          font-size: 12px;
          color: #94a3b8;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          font-weight: 500;
        }

        .feature-item:hover {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
          border-color: rgba(14, 165, 164, 0.3);
          color: #0ea5a4;
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 4px 12px rgba(14, 165, 164, 0.2);
        }

        .feature-icon {
          font-size: 14px;
          transition: transform 0.3s ease;
        }

        .feature-item:hover .feature-icon {
          transform: scale(1.2);
        }

        /* ==========================
           Message Rows & Bubbles (Enhanced)
           ========================== */
        .ai-row {
          display: flex;
          margin-bottom: 16px;
          gap: 12px;
          will-change: transform, opacity;
        }

        .ai-row.user {
          flex-direction: row-reverse;
        }

        .ai-bubble {
          max-width: 85%;
          background: linear-gradient(135deg, rgba(30,41,59,0.6), rgba(15,23,42,0.4));
          padding: 16px 18px;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(2,6,23,0.4);
          border: 1px solid rgba(14, 165, 164, 0.05);
          color: #e6eef8;
          word-break: break-word;
          overflow-wrap: anywhere;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          backdrop-filter: blur(12px);
          will-change: transform;
        }

        .ai-bubble:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(2,6,23,0.5);
          border-color: rgba(14, 165, 164, 0.08);
        }

        .ai-row.user .ai-bubble {
          background: linear-gradient(135deg, rgba(20,30,48,0.8), rgba(15,23,42,0.7));
          border: 1px solid rgba(148, 163, 184, 0.08);
        }

        .ai-row.user .ai-bubble:hover {
          border-color: rgba(148, 163, 184, 0.15);
        }

        .ai-ts {
          font-size: 11px;
          opacity: 0.7;
          margin-top: 8px;
          text-align: right;
          color: #94a3b8;
          transition: opacity 0.3s ease;
          font-weight: 400;
        }

        .ai-bubble:hover .ai-ts {
          opacity: 1;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
        }

        .loading-text {
          transition: color 0.3s ease;
          font-size: 13px;
        }

        .loading-indicator:hover .loading-text {
          color: #0ea5a4;
        }

        /* ==========================
           Enhanced Markdown Styling (Larger Font Size)
           ========================== */
        .markdown-wrap {
          line-height: 1.6;
          color: #e2e8f0;
          font-size: 14px; /* Increased from 12px */
          word-wrap: break-word;
        }
        
        .markdown-wrap p {
          margin: 0 0 14px 0;
          font-size: 14px; /* Explicitly set for paragraphs */
        }

        .user-text {
          font-size: 14px; /* Match user messages with AI messages */
          line-height: 1.5;
          color: #e6eef8;
        }

        /* Enhanced heading styles with better spacing */
        .markdown-h1,
        .markdown-h2,
        .markdown-h3,
        .markdown-h4,
        .markdown-h5,
        .markdown-h6 {
          margin: 20px 0 12px 0;
          color: #f1f5f9;
          font-weight: 600;
          line-height: 1.3;
          position: relative;
          padding-left: 18px;
          transition: all 0.3s ease;
        }

        .markdown-h1 {
          font-size: 1.4rem;
          padding-left: 16px;
          border-bottom: 2px solid rgba(14, 165, 164, 0.1);
          padding-bottom: 8px;
          margin-bottom: 16px;
        }

        .markdown-h2::before {
          content: "";
          position: absolute;
          left: 0;
          top: -8px;
          bottom: -8px;
          width: 4px;
          border-radius: 4px;
          background: linear-gradient(180deg, #06b6d4, #0891b2);
          box-shadow: 0 0 12px rgba(6,182,212,0.2);
          transition: all 0.3s ease;
        }

        .markdown-h2:hover::before {
          box-shadow: 0 0 20px rgba(6,182,212,0.3);
          width: 5px;
        }

        .markdown-h2 { font-size: 1.2rem; }

        .markdown-h3::before {
          content: "";
          position: absolute;
          left: 0;
          top: -6px;
          bottom: -6px;
          width: 3px;
          border-radius: 3px;
          background: linear-gradient(180deg, #60a5fa, #3b82f6);
          box-shadow: 0 0 8px rgba(59,130,246,0.15);
          transition: all 0.3s ease;
        }

        .markdown-h3:hover::before {
          box-shadow: 0 0 16px rgba(59,130,246,0.25);
          width: 4px;
        }

        .markdown-h3 { font-size: 1.1rem; }

        .markdown-h4::before {
          content: "";
          position: absolute;
          left: 0;
          top: -6px;
          bottom: -6px;
          width: 3px;
          border-radius: 3px;
          background: linear-gradient(180deg, #34d399, #10b981);
          box-shadow: 0 0 8px rgba(16,185,129,0.1);
          transition: all 0.3s ease;
        }

        .markdown-h4:hover::before {
          box-shadow: 0 0 16px rgba(16,185,129,0.2);
          width: 4px;
        }

        .markdown-h4 { font-size: 1.05rem; }

        .markdown-h5::before {
          content: "";
          position: absolute;
          left: 0;
          top: -4px;
          bottom: -4px;
          width: 2px;
          border-radius: 2px;
          background: linear-gradient(180deg, #fb7185, #f97316);
          box-shadow: 0 0 6px rgba(249,115,22,0.1);
          transition: all 0.3s ease;
        }

        .markdown-h5:hover::before {
          box-shadow: 0 0 12px rgba(249,115,22,0.15);
          width: 3px;
        }

        .markdown-h5 { font-size: 1.0rem; color: #d1d8df; }

        .markdown-h6::before {
          content: "";
          position: absolute;
          left: 0;
          top: -3px;
          bottom: -3px;
          width: 2px;
          border-radius: 2px;
          background: linear-gradient(180deg, #fbbf24, #f59e0b);
          transition: all 0.3s ease;
        }

        .markdown-h6:hover::before {
          box-shadow: 0 0 8px rgba(245,158,11,0.1);
          width: 3px;
        }

        .markdown-h6 { font-size: 0.95rem; color: #94a3b8; }

        /* Enhanced list styling */
        .markdown-ul,
        .markdown-ol {
          margin: 0 0 14px 24px;
          padding: 0;
        }
        
        .markdown-li {
          margin-bottom: 8px;
          padding-left: 6px;
          color: #dbe7f3;
          transition: color 0.3s ease;
          font-size: 14px; /* Increased from 11px */
          line-height: 1.5;
        }

        

        .markdown-ol {
          list-style-type: decimal;
        }
        .markdown-ul {
          list-style-type: disc;
        }

        /* Enhanced blockquote styling */
        .markdown-blockquote {
          border-left: 4px solid rgba(14, 116, 144, 0.8);
          margin: 16px 0;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(10, 18, 32, 0.4));
          border-radius: 0 8px 8px 0;
          color: #cbd5e1;
          font-style: italic;
          transition: all 0.3s ease;
          position: relative;
          backdrop-filter: blur(8px);
          font-size: 14px;
        }

        .markdown-blockquote:hover {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(10, 18, 32, 0.6));
          transform: translateX(4px);
          border-left-color: #0ea5a4;
          box-shadow: 0 2px 12px rgba(14, 165, 164, 0.1);
        }

        .markdown-hr {
          border: none;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.3), transparent);
          margin: 20px 0;
          transition: all 0.3s ease;
          border-radius: 1px;
        }

        .markdown-hr:hover {
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.5), transparent);
          height: 3px;
        }

        /* Fixed table styling with proper dimensions */
        .markdown-table-container {
          overflow-x: auto;
          margin: 16px 0;
          border-radius: 8px;
          border: 1px solid rgba(14, 165, 164, 0.1);
          background: linear-gradient(135deg, rgba(15,23,42,0.7), rgba(10,18,28,0.5));
          padding: 0;
          transition: all 0.3s ease;
          backdrop-filter: blur(8px);
          max-width: 100%;
        }

        .markdown-table-container:hover {
          border-color: rgba(14, 165, 164, 0.2);
          box-shadow: 0 4px 16px rgba(2,6,23,0.3);
          transform: translateY(-1px);
        }

        .markdown-table {
          width: auto;
          min-width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
        }
        
        .markdown-th,
        .markdown-td {
          border: 1px solid rgba(14, 165, 164, 0.08);
          padding: 8px 12px;
          text-align: left;
          font-size: 13px;
          transition: all 0.3s ease;
          vertical-align: top;
          word-wrap: break-word;
          min-width: 80px;
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .markdown-th:first-child,
        .markdown-td:first-child {
          border-left: none;
        }

        .markdown-th:last-child,
        .markdown-td:last-child {
          border-right: none;
        }

        .markdown-tr:first-child .markdown-th {
          border-top: none;
        }

        .markdown-tr:last-child .markdown-td {
          border-bottom: none;
        }
        
        .markdown-th {
          background: linear-gradient(135deg, rgba(14, 116, 144, 0.25), rgba(6, 78, 59, 0.2));
          color: #f1f5f9;
          font-weight: 600;
          font-size: 13px;
          height: 40px;
          white-space: nowrap;
        }
        
        .markdown-td {
          height: 36px;
          background: rgba(255,255,255,0.01);
        }
        
        .markdown-tr:nth-child(even) .markdown-td {
          background: rgba(255,255,255,0.025);
        }
        
        .markdown-tr:hover .markdown-td {
          background: rgba(14, 165, 164, 0.04);
        }

        .markdown-td:hover {
          background: rgba(14, 165, 164, 0.08) !important;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          position: relative;
          z-index: 10;
        }

        /* Enhanced code styling with no flicker */
        .code-block-wrapper {
          margin: 20px 0;
          border-radius: 8px;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(6,10,20,0.8), rgba(10,14,24,0.7));
          border: 1px solid rgba(14, 165, 164, 0.1);
          box-shadow: 0 4px 20px rgba(2,6,23,0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform, box-shadow;
          transform: translateZ(0); /* Force GPU acceleration */
        }

        

        .code-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(10,20,30,0.95), rgba(15,23,42,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
          transition: all 0.3s ease;
          backdrop-filter: blur(8px);
        }

        .code-language {
          font-weight: 600;
          color: #e6eef8;
          font-size: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          transition: color 0.3s ease;
        }

        .code-block-wrapper:hover .code-language {
          color: #0ea5a4;
        }

        .copy-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 12px;
        }
        
        .copy-btn:hover {
          background: rgba(14, 165, 164, 0.1);
          color: #e2e8f0;
          transform: translateY(-1px) scale(1.1);
        }

        /* Optimized syntax highlighter to prevent flicker */
        .syntax-highlighter {
          font-family: "Fira Code", "Monaco", "Cascadia Code", "Consolas", monospace !important;
          font-size: 13px !important; /* Increased from 11px */
          line-height: 1.4 !important;
          transition: none !important; /* Remove transitions that cause flicker */
          will-change: auto !important;
          contain: layout style paint !important; /* Improve rendering performance */
        }

        .syntax-highlighter pre {
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          white-space: pre !important;
          will-change: auto !important;
        }

        .syntax-highlighter code {
          display: block !important;
          overflow-x: auto !important;
          padding: 16px !important; /* Increased padding */
          font-size: 13px !important;
          will-change: auto !important;
        }

        /* Enhanced inline code */
        .plain-code,
        .ok-inline-code {
          background: rgba(14, 165, 164, 0.12);
          padding: 3px 6px;
          border-radius: 5px;
          font-family: "Fira Code", monospace;
          color: #e6eef8;
          font-size: 13px; /* Increased from 0.85em */
          border: 1px solid rgba(14, 165, 164, 0.08);
          white-space: pre-wrap;
          transition: all 0.3s ease;
        }

        .plain-code:hover,
        .ok-inline-code:hover {
          background: rgba(14, 165, 164, 0.18);
          border-color: rgba(14, 165, 164, 0.15);
          transform: translateY(-1px);
        }

        /* ==========================
           Continue Button & Controls
           ========================== */
        .continue-section {
          margin-top: 16px;
          text-align: center;
        }
        
        .continue-divider {
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.2), transparent);
          margin: 16px 0;
          transition: all 0.3s ease;
          border-radius: 1px;
        }

        .continue-section:hover .continue-divider {
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.4), transparent);
          height: 3px;
        }

        .continue-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, rgba(14,116,144,0.15), rgba(14,116,144,0.1));
          border: 1px solid rgba(14,116,144,0.25);
          color: #0ea5a4;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
        }
        
        .continue-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(14,116,144,0.25), rgba(14,116,144,0.2));
          border-color: rgba(14,116,144,0.4);
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.2);
        }
        
        .continue-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .continue-tip {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 8px;
          transition: color 0.3s ease;
        }

        .continue-section:hover .continue-tip {
          color: #cbd5e1;
        }

        /* Enhanced Input Section (Fixed Positioning & Performance) */
        .ai-input {
          display: flex;
          gap: 12px;
          padding: 16px 18px;
          border-top: 1px solid rgba(14, 165, 164, 0.08);
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.98));
          align-items: flex-end;
          backdrop-filter: blur(16px);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          flex-shrink: 0; /* Prevent input from shrinking */
          z-index: 10; /* Ensure input stays on top */
        }

        .ai-input::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.3), transparent);
          animation: shimmer 4s infinite;
        }

        .ai-input:hover {
          border-top-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,1));
        }

        .ai-textarea {
          flex: 1;
          resize: none;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          color: #e2e8f0;
          padding: 12px 14px;
          outline: none;
          border: 1px solid rgba(14, 165, 164, 0.1);
          line-height: 1.4;
          font-family: inherit;
          min-height: 42px;
          max-height: 150px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; /* Reduced transition time */
          font-size: 14px;
          backdrop-filter: blur(8px);
          will-change: contents;
          transform: translateZ(0);
          contain: layout; /* Improve rendering performance */
          overflow-wrap: break-word;
          word-break: break-word;
        }
        
        .ai-textarea:focus {
          border-color: rgba(14, 165, 164, 0.4);
          box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.1), 0 4px 16px rgba(2,6,23,0.3);
          background: rgba(255,255,255,0.06);
          transform: translateY(-2px) translateZ(0);
        }
        
        .ai-textarea::placeholder {
          color: #94a3b8;
          font-size: 14px;
        }
        
        .ai-textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Prevent text selection lag */
        .ai-textarea::selection {
          background: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
        }

        /* Enhanced send/stop buttons */
        .ai-send-btn, .ai-stop-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(12px);
          font-size: 14px;
          position: relative;
          overflow: hidden;
        }

        .ai-send-btn {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.25);
          color: #0ea5a4;
        }

        .ai-send-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(14, 165, 164, 0.2), transparent);
          transition: left 0.5s ease;
        }

        .ai-send-btn:hover:not(:disabled)::before {
          left: 100%;
        }

        .ai-send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.25), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.4);
          color: #0ea5a4;
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.25);
        }

        .ai-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ai-stop-btn {
          background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1));
          border: 1px solid rgba(239,68,68,0.25);
          color: #f87171;
          margin-right: 8px;
        }

        .ai-stop-btn:hover {
          background: linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.2));
          border-color: rgba(239,68,68,0.4);
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.25);
        }

        /* Enhanced scroll to bottom button */
        .scroll-to-bottom {
          position: absolute;
          right: 18px;
          bottom: 90px;
          z-index: 60;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(14,116,144,0.2), rgba(14,116,144,0.15));
          border: 1px solid rgba(14,116,144,0.3);
          color: #0ea5a4;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(2,6,23,0.4);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(16px);
          font-size: 14px;
        }
        
        .scroll-to-bottom:hover { 
          transform: translateY(-3px) scale(1.1); 
          background: linear-gradient(135deg, rgba(14,116,144,0.35), rgba(14,116,144,0.25));
          box-shadow: 0 8px 25px rgba(14, 165, 164, 0.3);
        }

        /* ==========================
           Settings Popover (Enhanced Dark Theme)
           ========================== */
        :global(.dark-settings-popover .ant-popover-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.15) !important;
          border-radius: 10px !important;
          box-shadow: 0 12px 40px rgba(2,6,23,0.6) !important;
          backdrop-filter: blur(20px) !important;
        }
        
        :global(.dark-settings-popover .ant-popover-title) {
          background: transparent !important;
          border-bottom: 1px solid rgba(14, 165, 164, 0.1) !important;
          color: #f1f5f9 !important;
          padding: 12px 16px !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        
        :global(.dark-settings-popover .ant-popover-inner-content) {
          padding: 16px !important;
          color: #e2e8f0 !important;
        }

        .settings-popover {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 200px;
        }
        
        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .settings-label {
          font-size: 12px;
          font-weight: 600;
          color: #0ea5a4;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .settings-popover-title {
          color: #0ea5a4 !important;
          font-weight: 600 !important;
        }

        /* Enhanced Ant Design component theming */
        :global(.dark-settings-popover .ant-select-selector) {
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          transition: all 0.3s ease !important;
          font-size: 12px !important;
          height: 32px !important;
        }

        :global(.dark-settings-popover .ant-select-selector:hover) {
          border-color: rgba(14, 165, 164, 0.4) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.08) !important;
          background: rgba(15, 23, 42, 0.9) !important;
        }
        
        :global(.dark-settings-popover .ant-select-arrow) {
          color: #0ea5a4 !important;
        }
        
        :global(.dark-settings-popover .ant-input-number) {
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          transition: all 0.3s ease !important;
          font-size: 12px !important;
          height: 32px !important;
        }

        :global(.dark-settings-popover .ant-input-number:hover) {
          border-color: rgba(14, 165, 164, 0.4) !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.08) !important;
          background: rgba(15, 23, 42, 0.9) !important;
        }

        :global(.dark-settings-popover .ant-input-number:focus-within) {
          border-color: rgba(14, 165, 164, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.15) !important;
        }
        
        :global(.dark-settings-popover .ant-input-number-input) {
          color: #e2e8f0 !important;
          font-size: 12px !important;
          height: 30px !important;
        }

        :global(.dark-settings-popover .ant-input-number-handler-wrap) {
          background: rgba(14, 165, 164, 0.08) !important;
          border-left: 1px solid rgba(14, 165, 164, 0.15) !important;
        }

        :global(.dark-settings-popover .ant-input-number-handler) {
          color: #0ea5a4 !important;
          transition: all 0.2s ease !important;
          font-size: 10px !important;
        }

        :global(.dark-settings-popover .ant-input-number-handler:hover) {
          background: rgba(14, 165, 164, 0.15) !important;
        }
        
        :global(.dark-select-dropdown) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          border-radius: 8px !important;
          box-shadow: 0 8px 25px rgba(2,6,23,0.5) !important;
          backdrop-filter: blur(16px) !important;
        }
        
        :global(.dark-select-dropdown .ant-select-item-option) {
          color: #e2e8f0 !important;
          padding: 8px 12px !important;
          transition: all 0.2s ease !important;
          font-size: 12px !important;
        }
        
        :global(.dark-select-dropdown .ant-select-item-option:hover) {
          background: rgba(14, 165, 164, 0.1) !important;
          color: #0ea5a4 !important;
          transform: translateX(2px) !important;
        }
        
        :global(.dark-select-dropdown .ant-select-item-option-selected) {
          background: rgba(14, 165, 164, 0.2) !important;
          color: #0ea5a4 !important;
          font-weight: 600 !important;
        }

        .settings-save-btn {
          margin-top: 8px;
          background: linear-gradient(135deg, #0ea5a4, #0891b2) !important;
          border: 1px solid rgba(14, 165, 164, 0.3) !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.2) !important;
          font-size: 12px !important;
          height: 32px !important;
        }

        .settings-save-btn:hover {
          background: linear-gradient(135deg, #0891b2, #06b6d4) !important;
          transform: translateY(-2px) scale(1.02) !important;
          box-shadow: 0 4px 16px rgba(14, 165, 164, 0.3) !important;
        }

        /* ==========================
           Enhanced Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .ai-shell {
            border-radius: 6px;
          }

          .ai-header {
            padding: 10px 14px;
          }

          .ai-title {
            font-size: 13px;
          }

          .ai-title-icon {
            font-size: 13px;
          }

          .dock-btn, .settings-btn, .clear-btn {
            width: 28px;
            height: 28px;
            font-size: 11px;
          }

          .ai-body {
            padding: 14px 16px;
          }

          .ai-bubble { 
            max-width: 90%; 
            border-radius: 10px; 
            padding: 12px 14px; 
          }

          .markdown-wrap { 
            font-size: 13px; 
          }

          .user-text {
            font-size: 13px;
          }

          .ai-input { 
            padding: 12px 14px;
            gap: 10px;
          }

          .ai-textarea {
            font-size: 13px;
            min-height: 38px;
            padding: 10px 12px;
          }

          .ai-send-btn, .ai-stop-btn {
            width: 38px;
            height: 38px;
            font-size: 13px;
          }

          .code-block-header { 
            padding: 8px 12px; 
          }
          
          .syntax-highlighter code { 
            padding: 12px !important; 
            font-size: 12px !important; 
          }

          .scroll-to-bottom { 
            right: 14px; 
            bottom: 80px; 
            width: 38px;
            height: 38px;
            font-size: 13px;
          }

          .welcome-features {
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }
          
          .feature-item {
            min-width: 140px;
            justify-content: center;
            padding: 8px 12px;
          }

          .ai-summary-mode {
            padding: 14px;
          }

          .ai-show-full-btn {
            padding: 10px 14px;
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .ai-header {
            padding: 8px 12px;
          }
          
          .ai-title {
            font-size: 12px;
          }

          .ai-title-icon {
            font-size: 12px;
          }
          
          .ai-controls {
            gap: 6px;
          }
          
          .dock-btn, .settings-btn, .clear-btn {
            padding: 4px 6px;
            font-size: 10px;
            width: 24px;
            height: 24px;
          }

          .ai-body {
            padding: 12px 14px;
          }
          
          .ai-bubble {
            padding: 10px 12px;
            border-radius: 8px;
          }

          .markdown-wrap {
            font-size: 12px;
          }

          .user-text {
            font-size: 12px;
          }

          .ai-input {
            padding: 10px 12px;
            gap: 8px;
          }
          
          .ai-textarea {
            min-height: 34px;
            padding: 8px 10px;
            font-size: 12px;
          }
          
          .ai-send-btn, .ai-stop-btn {
            width: 34px;
            height: 34px;
            font-size: 12px;
          }

          .scroll-to-bottom {
            width: 34px;
            height: 34px;
            right: 12px;
            bottom: 70px;
            font-size: 12px;
          }

          .welcome-title {
            font-size: 14px;
          }

          .welcome-subtitle {
            font-size: 12px;
          }

          .feature-item {
            font-size: 11px;
            padding: 6px 10px;
          }
        }

        /* ==========================
           Enhanced Focus States & Accessibility
           ========================== */
        .copy-btn:focus-visible, 
        .clear-btn:focus-visible, 
        .ai-send-btn:focus-visible, 
        .continue-btn:focus-visible, 
        .ai-stop-btn:focus-visible, 
        .scroll-to-bottom:focus-visible,
        .dock-btn:focus-visible,
        .settings-btn:focus-visible,
        .ai-show-full-btn:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px rgba(14, 165, 164, 0.1) !important;
        }

        .ai-textarea:focus-visible {
          outline: none !important;
        }

        /* ==========================
           Enhanced Performance Optimizations
           ========================== */
        .ai-shell,
        .ai-bubble,
        .code-block-wrapper,
        .markdown-table-container {
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        .ai-body {
          contain: layout style paint;
        }

        .syntax-highlighter {
          contain: layout style;
        }

        .ai-textarea {
          contain: layout;
        }

        /* ==========================
           Enhanced Text Selection
           ========================== */
        .ai-bubble *::selection {
          background: rgba(14, 165, 164, 0.25);
          color: #f1f5f9;
        }

        .ai-textarea::selection {
          background: rgba(14, 165, 164, 0.3);
          color: #f1f5f9;
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .ai-title-icon {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.3));
        }

        .ai-title.group:hover .ai-title-icon {
          filter: drop-shadow(0 0 12px rgba(14, 165, 164, 0.5));
        }

        .ai-send-btn:hover:not(:disabled) {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.3));
        }

        .ai-stop-btn:hover {
          filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.3));
        }

        .continue-btn:hover:not(:disabled) {
          filter: drop-shadow(0 0 6px rgba(14, 165, 164, 0.2));
        }

        /* ==========================
           Enhanced Loading States
           ========================== */
        :global(.ant-spin-dot-item) {
          background-color: #0ea5a4 !important;
          box-shadow: 0 0 4px rgba(14, 165, 164, 0.3) !important;
        }

        /* ==========================
           Enhanced Tooltip Styling
           ========================== */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.25) !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important;
          backdrop-filter: blur(12px) !important;
          font-size: 11px !important;
          box-shadow: 0 4px 16px rgba(2,6,23,0.4) !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.25) !important;
        }

        /* ==========================
           Enhanced Message Notifications
           ========================== */
        :global(.ant-message-notice-content) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.25) !important;
          color: #e2e8f0 !important;
          border-radius: 8px !important;
          backdrop-filter: blur(16px) !important;
          box-shadow: 0 6px 20px rgba(2,6,23,0.4) !important;
          font-size: 12px !important;
        }

        /* ==========================
           Smooth Scrolling & Transitions
           ========================== */
        * {
          scroll-behavior: smooth;
        }

        .ai-body {
          scroll-behavior: smooth;
        }

        /* ==========================
           Print Styles
           ========================== */
        @media print {
          .ai-shell {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }

          .ai-bubble {
            background: #f5f5f5 !important;
            border: 1px solid #ddd !important;
            color: black !important;
          }

          .ai-header,
          .ai-input,
          .scroll-to-bottom {
            display: none !important;
          }
        }

        /* ==========================
           High Contrast Mode Support
           ========================== */
        @media (prefers-contrast: high) {
          .ai-shell {
            border: 2px solid rgba(14, 165, 164, 0.5) !important;
          }

          .ai-bubble {
            border: 1px solid rgba(14, 165, 164, 0.3) !important;
          }

          .ai-send-btn, .ai-stop-btn {
            border: 2px solid currentColor !important;
          }
        }

        // Add these styles to your existing style section:

/* ==========================
   Enhanced Settings Modal Styling
   ========================== */
   {
:global(.dark-settings-popover .ant-popover-inner) {
  background: linear-gradient(135deg, #0f172a, #071126) !important;
  border: 1px solid rgba(14, 165, 164, 0.15) !important;
  border-radius: 12px !important;
  box-shadow: 0 20px 60px rgba(2,6,23,0.7), 0 8px 25px rgba(14,165,164,0.1) !important;
  backdrop-filter: blur(20px) !important;
  overflow: hidden !important;
}

:global(.dark-settings-popover .ant-popover-inner::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at top right, rgba(14, 165, 164, 0.03), transparent 70%);
  pointer-events: none;
  z-index: 0;
}

:global(.dark-settings-popover .ant-popover-title) {
  background: transparent !important;
  border-bottom: 1px solid rgba(14, 165, 164, 0.1) !important;
  color: #f1f5f9 !important;
  padding: 16px 20px 12px 20px !important;
  margin: 0 !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  position: relative;
  z-index: 1;
}

:global(.dark-settings-popover .ant-popover-inner-content) {
  padding: 0 !important;
  color: #e2e8f0 !important;
  position: relative;
  z-index: 1;
}

.settings-popover {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  max-width: 320px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(14, 165, 164, 0.08);
  background: linear-gradient(135deg, rgba(15,23,42,0.8), rgba(7,17,27,0.6));
}

.settings-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
  border: 1px solid rgba(14, 165, 164, 0.15);
  color: #0ea5a4;
  font-size: 14px;
}

.settings-header-text {
  font-size: 15px;
  font-weight: 600;
  color: #0ea5a4;
  letter-spacing: 0.3px;
}

.settings-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #0ea5a4;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.label-icon {
  font-size: 14px;
  filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.3));
}

.token-limit-info {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  font-style: italic;
  text-align: center;
  padding: 6px 8px;
  background: rgba(14, 165, 164, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 164, 0.1);
}

.settings-footer {
  padding: 16px 20px 20px 20px;
  border-top: 1px solid rgba(14, 165, 164, 0.08);
  background: linear-gradient(135deg, rgba(15,23,42,0.6), rgba(7,17,27,0.4));
}

/* Enhanced Select Component */
:global(.dark-settings-popover .ant-select-selector) {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(7, 17, 27, 0.6)) !important;
  border: 1px solid rgba(14, 165, 164, 0.2) !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  transition: all 0.3s ease !important;
  font-size: 13px !important;
  height: 36px !important;
  backdrop-filter: blur(8px) !important;
}

:global(.dark-settings-popover .ant-select-selector:hover) {
  border-color: rgba(14, 165, 164, 0.4) !important;
  box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.08) !important;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(7, 17, 27, 0.8)) !important;
  transform: translateY(-1px) !important;
}

:global(.dark-settings-popover .ant-select-selector:focus-within) {
  border-color: rgba(14, 165, 164, 0.5) !important;
  box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.15) !important;
}

:global(.dark-settings-popover .ant-select-arrow) {
  color: #0ea5a4 !important;
  transition: all 0.3s ease !important;
}

:global(.dark-settings-popover .ant-select-selector:hover .ant-select-arrow) {
  transform: scale(1.1) !important;
}

/* Enhanced Input Number Component */
:global(.dark-settings-popover .ant-input-number) {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(7, 17, 27, 0.6)) !important;
  border: 1px solid rgba(14, 165, 164, 0.2) !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  transition: all 0.3s ease !important;
  font-size: 13px !important;
  height: 36px !important;
  backdrop-filter: blur(8px) !important;
  width: 100% !important;
}

:global(.dark-settings-popover .ant-input-number:hover) {
  border-color: rgba(14, 165, 164, 0.4) !important;
  box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.08) !important;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(7, 17, 27, 0.8)) !important;
  transform: translateY(-1px) !important;
}

:global(.dark-settings-popover .ant-input-number:focus-within) {
  border-color: rgba(14, 165, 164, 0.5) !important;
  box-shadow: 0 0 0 3px rgba(14, 165, 164, 0.15) !important;
}

:global(.dark-settings-popover .ant-input-number-input) {
  color: #e2e8f0 !important;
  font-size: 13px !important;
  height: 34px !important;
  background: transparent !important;
}

:global(.dark-settings-popover .ant-input-number-handler-wrap) {
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.08), rgba(14, 116, 144, 0.05)) !important;
  border-left: 1px solid rgba(14, 165, 164, 0.15) !important;
  border-radius: 0 8px 8px 0 !important;
}

:global(.dark-settings-popover .ant-input-number-handler) {
  color: #0ea5a4 !important;
  transition: all 0.2s ease !important;
  font-size: 10px !important;
  background: transparent !important;
  border-color: rgba(14, 165, 164, 0.1) !important;
}

:global(.dark-settings-popover .ant-input-number-handler:hover) {
  background: rgba(14, 165, 164, 0.15) !important;
  color: #06b6d4 !important;
}

:global(.dark-settings-popover .ant-input-number-handler-up-inner,
        .dark-settings-popover .ant-input-number-handler-down-inner) {
  color: #0ea5a4 !important;
  font-size: 10px !important;
}

/* Enhanced Dropdown Styling */
:global(.dark-select-dropdown) {
  background: linear-gradient(135deg, #0f172a, #071126) !important;
  border: 1px solid rgba(14, 165, 164, 0.2) !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(2,6,23,0.6), 0 4px 16px rgba(14,165,164,0.1) !important;
  backdrop-filter: blur(20px) !important;
  overflow: hidden !important;
}

:global(.dark-select-dropdown::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at top right, rgba(14, 165, 164, 0.03), transparent 70%);
  pointer-events: none;
}

:global(.dark-select-dropdown .ant-select-item) {
  color: #e2e8f0 !important;
  padding: 10px 12px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  font-size: 13px !important;
  border-bottom: 1px solid rgba(14, 165, 164, 0.05) !important;
  margin: 0 !important;
}

:global(.dark-select-dropdown .ant-select-item:last-child) {
  border-bottom: none !important;
}

:global(.dark-select-dropdown .ant-select-item:hover) {
  background: rgba(14, 165, 164, 0.1) !important;
  color: #0ea5a4 !important;
  transform: translateX(4px) !important;
  border-color: rgba(14, 165, 164, 0.1) !important;
}

:global(.dark-select-dropdown .ant-select-item-option-selected) {
  background: rgba(14, 165, 164, 0.2) !important;
  color: #0ea5a4 !important;
  font-weight: 600 !important;
}

:global(.dark-select-dropdown .ant-select-item-option-active) {
  background: rgba(14, 165, 164, 0.15) !important;
}

/* Save Button Styling */
.settings-save-btn {
  background: linear-gradient(135deg, #0ea5a4, #0891b2) !important;
  border: 1px solid rgba(14, 165, 164, 0.3) !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-shadow: 0 2px 8px rgba(14, 165, 164, 0.2) !important;
  font-size: 13px !important;
  height: 36px !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
}

.settings-save-btn:hover {
  background: linear-gradient(135deg, #0891b2, #06b6d4) !important;
  border-color: rgba(14, 165, 164, 0.5) !important;
  transform: translateY(-2px) scale(1.02) !important;
  box-shadow: 0 4px 16px rgba(14, 165, 164, 0.3) !important;
  color: white !important;
}

.settings-save-btn:active {
  transform: translateY(0) scale(1) !important;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .settings-popover {
    min-width: 260px;
    max-width: 280px;
  }
  
  .settings-header {
    padding: 14px 16px;
    gap: 10px;
  }
  
  .settings-header-icon {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
  
  .settings-header-text {
    font-size: 14px;
  }
  
  .settings-body {
    padding: 16px;
    gap: 16px;
  }
  
  .settings-footer {
    padding: 14px 16px 16px 16px;
  }
  
  :global(.dark-settings-popover .ant-select-selector) {
    height: 34px !important;
    font-size: 12px !important;
  }
  
  :global(.dark-settings-popover .ant-input-number) {
    height: 34px !important;
    font-size: 12px !important;
  }
  
  :global(.dark-settings-popover .ant-input-number-input) {
    font-size: 12px !important;
    height: 32px !important;
  }
  
  .settings-save-btn {
    height: 34px !important;
    font-size: 12px !important;
  }
}

@media (max-width: 480px) {
  .settings-popover {
    min-width: 240px;
    max-width: 260px;
  }
  
  .settings-header {
    padding: 12px 14px;
  }
  
  .settings-body {
    padding: 14px;
    gap: 14px;
  }
  
  .settings-footer {
    padding: 12px 14px 14px 14px;
  }
  
  .settings-label {
    font-size: 11px;
  }
  
  .label-icon {
    font-size: 12px;
  }
  
  .token-limit-info {
    font-size: 10px;
    padding: 4px 6px;
  }
}

/* Animation for modal appearance */
@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

:global(.dark-settings-popover) {
  animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* Focus states for accessibility */
:global(.dark-settings-popover .ant-select-selector:focus-within),
:global(.dark-settings-popover .ant-input-number:focus-within),
.settings-save-btn:focus {
  outline: 2px solid rgba(14, 165, 164, 0.5) !important;
  outline-offset: 1px !important;
}

/* Loading state for save button */
.settings-save-btn:disabled {
  opacity: 0.6 !important;
  transform: none !important;
  cursor: not-allowed !important;
}
      }
/* Compact Settings Popover */
.compact-settings-popover .ant-popover-inner {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 12px !important;
}

.compact-settings-popover .ant-popover-arrow {
  display: none !important;
}

.compact-select .ant-select-selector {
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  border-radius: 6px !important;
  color: #e2e8f0 !important;
  height: 28px !important;
  font-size: 12px !important;
}

.compact-select .ant-select-selection-item {
  font-size: 12px !important;
  line-height: 26px !important;
}

.compact-input-number .ant-input-number {
  width: 100% !important;
  height: 28px !important;
}

.compact-input-number .ant-input-number-input {
  background: rgba(30, 41, 59, 0.6) !important;
  border: 1px solid rgba(71, 85, 105, 0.3) !important;
  border-radius: 6px !important;
  color: #e2e8f0 !important;
  height: 28px !important;
  font-size: 12px !important;
}

.compact-save-btn {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 0 12px !important;
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.9), rgba(14, 116, 144, 0.8)) !important;
  border: 1px solid rgba(14, 165, 164, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  height: 28px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.compact-save-btn:hover {
  background: linear-gradient(135deg, rgba(14, 165, 164, 1), rgba(14, 116, 144, 0.9)) !important;
  border-color: rgba(14, 165, 164, 0.5) !important;
  transform: translateY(-1px) !important;
}

/* Compact select dropdown */
.compact-select-dropdown .ant-select-item {
  min-height: 28px !important;
  font-size: 12px !important;
  line-height: 28px !important;
  padding: 0 12px !important;
}

.compact-select-dropdown .ant-select-item-option-active {
  background: rgba(14, 165, 164, 0.15) !important;
}
      `}</style>
    </div>
  );
}