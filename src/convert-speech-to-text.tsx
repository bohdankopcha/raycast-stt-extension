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
      
      // Use ffmpeg with macOS AVFoundation
      recordingProcessRef.current = spawn("/opt/homebrew/bin/ffmpeg", [
        "-f", "avfoundation",       // macOS audio input
        "-i", ":default",           // default microphone (system default audio input)
        "-fflags", "nobuffer",      // disable buffering for immediate capture
        "-flags", "low_delay",      // low latency mode
        "-ar", "16000",             // sample rate
        "-ac", "1",                 // mono
        "-y",                       // overwrite output file
        outputPath,
      ]);

      // Log errors for debugging
      recordingProcessRef.current.stderr?.on("data", (data: Buffer) => {
        console.log("ffmpeg stderr:", data.toString());
      });

      recordingProcessRef.current.on("error", (error: Error) => {
        showToast({
          style: Toast.Style.Failure,
          title: "Recording error",
          message: error.message,
        });
      });

      // Give ffmpeg time to initialize audio device
      await new Promise(resolve => setTimeout(resolve, 800));

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
    if (!recordingProcessRef.current) return;

    try {
      await showToast({
        style: Toast.Style.Animated,
        title: "Stopping recording...",
      });

      // Wait for ffmpeg to close properly
      await new Promise<void>((resolve) => {
        recordingProcessRef.current.once("close", () => {
          console.log("ffmpeg closed");
          resolve();
        });
        
        // Send q key to ffmpeg to stop gracefully
        recordingProcessRef.current.stdin?.write("q");
        recordingProcessRef.current.stdin?.end();
        
        // Fallback: kill after 3 seconds if not closed
        setTimeout(() => {
          if (recordingProcessRef.current) {
            recordingProcessRef.current.kill("SIGKILL");
            resolve();
          }
        }, 3000);
      });

      recordingProcessRef.current = null;
      setIsRecording(false);

      await showToast({
        style: Toast.Style.Success,
        title: "Recording saved",
        message: outputFileRef.current,
      });
    } catch (error) {
      setIsRecording(false);
      recordingProcessRef.current = null;
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

