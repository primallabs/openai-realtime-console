import { AssistantStream } from "openai/lib/AssistantStream";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import { AssistantStreamEvent } from "openai/resources/beta/assistants";
import { openai } from "./openai";

type FileUploadToolCall = {
  file: File;
};

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

export class ConversationProxy {
    
    private threadId: string | null = null;
    private messages: MessageProps[] = [];
    private isAwaitingResponse: boolean = false;
    isInputActive: boolean = true;
    
    eventsEnabled: boolean = false;
    onConversationResponseStart: (() => void) | null = null;
    onConversationResponseUpdate: ((text: string) => void) | null = null;
    onConversationResponseEnd: (() => void) | null = null;


    public async waitForResponse() : Promise<ConversationProxy> {
        while(this.isAwaitingResponse) {
          setTimeout(() => {}, 100);
        }
        return this;
    }

    public getResponseContent() {
        return this.messages[this.messages.length - 1].text;
    }

    public async sendMessage(text: string) : Promise<ConversationProxy> {
        if (!this.threadId) throw new Error("Thread ID is null");
        this.isAwaitingResponse = true;
        const response = await fetch(
            `/api/assistants/${this.assistantId}/threads/${this.threadId}/messages`,
            {
                method: "POST",
                body: JSON.stringify({
                    content: text,
                }),
            }
        );
        if (response.body) {
            const stream = AssistantStream.fromReadableStream(response.body);
            this.handleReadableStream(stream);
            return this;
        }
        
        this.isAwaitingResponse = false;
        throw new Error("Failed to send message");
    }

    constructor(public assistantId: string, private functionCallHandler: (toolCall: RequiredActionFunctionToolCall) => Promise<string> = () => Promise.resolve("")) {
        this.createThread();
    }

    private async createThread() {
        const res = await fetch(`/api/assistants/${this.assistantId}/threads`, {
            method: "POST",
        });
        const data = await res.json();
        this.threadId = data.threadId;
    }

    private async submitActionResult(runId: string, toolCallOutputs: any) {
        if (!this.threadId) return;
        const response = await fetch(
            `/api/assistants/${this.assistantId}/threads/${this.threadId}/actions`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    runId: runId,
                    toolCallOutputs: toolCallOutputs,
                }),
            }
        );

        if (!response.body) throw new Error("Failed to submit action result");

        const stream = AssistantStream.fromReadableStream(response.body);
        this.handleReadableStream(stream);
    }

    private handleReadableStream(stream: AssistantStream) {
        stream.on("textCreated", this.handleTextCreated.bind(this));
        stream.on("textDelta", this.handleTextDelta.bind(this));
        stream.on("imageFileDone", this.handleImageFileDone.bind(this));
        stream.on("toolCallCreated", this.toolCallCreated.bind(this));
        stream.on("toolCallDelta", this.toolCallDelta.bind(this));
        stream.on("event", (event) => {
            if (event.event === "thread.run.requires_action")
                this.handleRequiresAction(event);
            if (event.event === "thread.run.completed") this.handleRunCompleted();
        });
        stream.on("end", this.handleEndResponse.bind(this));
    }

    private handleEndResponse() {
        if(this.eventsEnabled)
            this.onConversationResponseEnd?.();
        this.isAwaitingResponse = false;
    }

    private handleTextCreated() {
        this.appendMessage("assistant", "");
        if(this.eventsEnabled)
            this.onConversationResponseStart?.();
    }

    private handleTextDelta(delta: any) {
        if (delta.value != null) {
            this.appendToLastMessage(delta.value);
            if(this.eventsEnabled)
                this.onConversationResponseUpdate?.(delta.value);
        }
        if (delta.annotations != null) {
            this.annotateLastMessage(delta.annotations);
        }
    }

    private handleImageFileDone(image: any) {
        this.appendToLastMessage(`\n![${image.file_id}](/api/files/${image.file_id})\n`);
    }

    private toolCallCreated(toolCall: any) {
        if (toolCall.type === "code_interpreter") {
            this.appendMessage("code", "");
        } 
    }

    private toolCallDelta(delta: any, snapshot: any) {
        if (delta.type != "code_interpreter") return;
        if (!delta.code_interpreter.input) return;
        this.appendToLastMessage(delta.code_interpreter.input);
    }

    private async handleRequiresAction(event: AssistantStreamEvent.ThreadRunRequiresAction) {
        const runId = event.data.id;

        if (event.data.required_action == null) throw new Error("No required action found"); 

        const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
        const toolCallOutputs = await Promise.all(
            toolCalls.map(async (toolCall) => {
                const result = await this.functionCallHandler(toolCall);
                return { output: result, tool_call_id: toolCall.id };
            })
        );
        this.isInputActive = true;
        this.submitActionResult(runId, toolCallOutputs);
    }

    private handleRunCompleted() {
        this.isInputActive = false;
    }

    private appendToLastMessage(text: string) {
        const lastMessage = this.messages[this.messages.length - 1];
        lastMessage.text += text;
    }

    private appendMessage(role: "user" | "assistant" | "code", text: string) {
        this.messages.push({ role, text });
    }

    private annotateLastMessage(annotations: any) {
        const lastMessage = this.messages[this.messages.length - 1];
        annotations.forEach((annotation: any) => {
            if (annotation.type === 'file_path') {
                lastMessage.text = lastMessage.text.replaceAll(
                    annotation.text,
                    `/api/files/${annotation.file_path.file_id}`
                );
            }
        });
    }
}




// type MessageProps = {
//   role: "user" | "assistant" | "code";
//   text: string;
// };

// const UserMessage = ({ text }: { text: string }) => {
//   return <div className={styles.userMessage}>{text}</div>;
// };

// const AssistantMessage = ({ text }: { text: string }) => {
//   return (
//     <div className={styles.assistantMessage}>
//       <Markdown>{text}</Markdown>
//     </div>
//   );
// };

// const CodeMessage = ({ text }: { text: string }) => {
//   return (
//     <div className={styles.codeMessage}>
//       {text.split("\n").map((line, index) => (
//         <div key={index}>
//           <span>{`${index + 1}. `}</span>
//           {line}
//         </div>
//       ))}
//     </div>
//   );
// };

// const Message = ({ role, text }: MessageProps) => {
//   switch (role) {
//     case "user":
//       return <UserMessage text={text} />;
//     case "assistant":
//       return <AssistantMessage text={text} />;
//     case "code":
//       return <CodeMessage text={text} />;
//     default:
//       return null;
//   }
// };

// type ChatProps = {
//   functionCallHandler?: (
//     toolCall: RequiredActionFunctionToolCall
//   ) => Promise<string>;
// };

// const ConversationProxy = ({
//   functionCallHandler = () => Promise.resolve(""), // default to return empty string
// }: ChatProps) => {
  

//   // automatically scroll to bottom of chat
//   const messagesEndRef = useRef<HTMLDivElement | null>(null);
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };
//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   // create a new threadID when chat component created
//   useEffect(() => {
//     const createThread = async () => {
//       const res = await fetch(`/api/assistants/threads`, {
//         method: "POST",
//       });
//       const data = await res.json();
//       setThreadId(data.threadId);
//     };
//     createThread();
//   }, []);

//   const sendMessage = async (text) => {
//     const response = await fetch(
//       `/api/assistants/threads/${threadId}/messages`,
//       {
//         method: "POST",
//         body: JSON.stringify({
//           content: text,
//         }),
//       }
//     );
//     const stream = AssistantStream.fromReadableStream(response.body);
//     handleReadableStream(stream);
//   };

//   const submitActionResult = async (runId, toolCallOutputs) => {
//     const response = await fetch(
//       `/api/assistants/threads/${threadId}/actions`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           runId: runId,
//           toolCallOutputs: toolCallOutputs,
//         }),
//       }
//     );
//     const stream = AssistantStream.fromReadableStream(response.body);
//     handleReadableStream(stream);
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (!userInput.trim()) return;
//     sendMessage(userInput);
//     setMessages((prevMessages) => [
//       ...prevMessages,
//       { role: "user", text: userInput },
//     ]);
//     setUserInput("");
//     setInputDisabled(true);
//     scrollToBottom();
//   };

//   /* Stream Event Handlers */

//   // textCreated - create new assistant message
//   const handleTextCreated = () => {
//     appendMessage("assistant", "");
//   };

//   // textDelta - append text to last assistant message
//   const handleTextDelta = (delta) => {
//     if (delta.value != null) {
//       appendToLastMessage(delta.value);
//     };
//     if (delta.annotations != null) {
//       annotateLastMessage(delta.annotations);
//     }
//   };

//   // imageFileDone - show image in chat
//   const handleImageFileDone = (image) => {
//     appendToLastMessage(`\n![${image.file_id}](/api/files/${image.file_id})\n`);
//   }

//   // toolCallCreated - log new tool call
//   const toolCallCreated = (toolCall) => {
//     if (toolCall.type != "code_interpreter") return;
//     appendMessage("code", "");
//   };

//   // toolCallDelta - log delta and snapshot for the tool call
//   const toolCallDelta = (delta, snapshot) => {
//     if (delta.type != "code_interpreter") return;
//     if (!delta.code_interpreter.input) return;
//     appendToLastMessage(delta.code_interpreter.input);
//   };

//   // handleRequiresAction - handle function call
//   const handleRequiresAction = async (
//     event: AssistantStreamEvent.ThreadRunRequiresAction
//   ) => {
//     const runId = event.data.id;
//     const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
//     // loop over tool calls and call function handler
//     const toolCallOutputs = await Promise.all(
//       toolCalls.map(async (toolCall) => {
//         const result = await functionCallHandler(toolCall);
//         return { output: result, tool_call_id: toolCall.id };
//       })
//     );
//     setInputDisabled(true);
//     submitActionResult(runId, toolCallOutputs);
//   };

//   // handleRunCompleted - re-enable the input form
//   const handleRunCompleted = () => {
//     setInputDisabled(false);
//   };

//   const handleReadableStream = (stream: AssistantStream) => {
//     // messages
//     stream.on("textCreated", handleTextCreated);
//     stream.on("textDelta", handleTextDelta);

//     // image
//     stream.on("imageFileDone", handleImageFileDone);

//     // code interpreter
//     stream.on("toolCallCreated", toolCallCreated);
//     stream.on("toolCallDelta", toolCallDelta);

//     // events without helpers yet (e.g. requires_action and run.done)
//     stream.on("event", (event) => {
//       if (event.event === "thread.run.requires_action")
//         handleRequiresAction(event);
//       if (event.event === "thread.run.completed") handleRunCompleted();
//     });
//   };

//   /*
//     =======================
//     === Utility Helpers ===
//     =======================
//   */

//   const appendToLastMessage = (text) => {
//     setMessages((prevMessages) => {
//       const lastMessage = prevMessages[prevMessages.length - 1];
//       const updatedLastMessage = {
//         ...lastMessage,
//         text: lastMessage.text + text,
//       };
//       return [...prevMessages.slice(0, -1), updatedLastMessage];
//     });
//   };

//   const appendMessage = (role, text) => {
//     setMessages((prevMessages) => [...prevMessages, { role, text }]);
//   };

//   const annotateLastMessage = (annotations) => {
//     setMessages((prevMessages) => {
//       const lastMessage = prevMessages[prevMessages.length - 1];
//       const updatedLastMessage = {
//         ...lastMessage,
//       };
//       annotations.forEach((annotation) => {
//         if (annotation.type === 'file_path') {
//           updatedLastMessage.text = updatedLastMessage.text.replaceAll(
//             annotation.text,
//             `/api/files/${annotation.file_path.file_id}`
//           );
//         }
//       })
//       return [...prevMessages.slice(0, -1), updatedLastMessage];
//     });
    
//   }

// };

export default ConversationProxy;
