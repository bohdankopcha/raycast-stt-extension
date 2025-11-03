import { Action, ActionPanel, Form, showToast, Toast } from "@raycast/api";
import { useState, useRef } from "react";
import { spawn } from "child_process";
import * as path from "path";
import * as os from "os";

export default function Command() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingProcessRef = useRef<any>(null);
  const outputFileRef = useRef<string>("");

  const startRecording = async () => {
    try {
      const timestamp = new Date().getTime();
      const outputPath = path.join(os.homedir(), "Downloads", `recording-${timestamp}.wav`);
      outputFileRef.current = outputPath;

      await showToast({
        style: Toast.Style.Animated,
        title: "Starting the recording...",
      });
      
      recordingProcessRef.current = spawn("/opt/homebrew/bin/sox", [
        "-d", // default audio device
        "-r", "16000", // sample rate
        "-c", "1", // mono
        "-b", "16", // 16-bit
        outputPath,
      ]);

      recordingProcessRef.current.on("error", (error: Error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Error occurred",
          message: error.message,
        });
      });

      setIsRecording(true);

      await showToast({
        style: Toast.Style.Success,
        title: "Recording started",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to start recording",
      });
    }
  };

  const stopRecording = async () => {
    try {
      if (recordingProcessRef.current) {
        recordingProcessRef.current.kill("SIGINT");
        recordingProcessRef.current = null;
      }

      setIsRecording(false);

      await showToast({
        style: Toast.Style.Success,
        title: "Recording saved",
        message: outputFileRef.current,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to stop recording",
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          {!isRecording ? (
            <Action title="Start recording" onAction={startRecording} />
          ) : (
            <Action title="Stop recording" onAction={stopRecording} />
          )}
        </ActionPanel>
      }
    >
      <Form.Description
        title="Status"
        text={isRecording ? "🔴 Recording..." : "⚪️ Ready to record"}
      />
      <Form.Description
        title="Instruction"
        text="Press Cmd+Enter to start/stop recording"
      />
    </Form>
  );
}

