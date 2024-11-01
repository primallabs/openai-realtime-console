export interface ToolCallOutputs {
  tool_outputs: Array<{
    output: any;
    tool_call_id: string;
  }>;
}